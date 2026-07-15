import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { CID } from 'multiformats/cid'
import type { Helia } from 'helia'
import { log } from './debug'

let helia: Helia | null = null
let fs: ReturnType<typeof unixfs> | null = null
let initPromise: Promise<Helia> | null = null

/** Initialize the in-browser IPFS (Helia) node. Idempotent. */
export async function initIpfs(): Promise<Helia> {
  if (helia) return helia
  if (initPromise) return initPromise

  initPromise = (async () => {
    const node = await createHelia()
    helia = node
    fs = unixfs(node)
    return node
  })()

  return initPromise
}

/** Returns the libp2p PeerId string for the running Helia node. */
export async function getNodeId(): Promise<string> {
  const node = await initIpfs()
  try {
    return node.libp2p.peerId.toString()
  } catch {
    return ''
  }
}

/**
 * Public IPFS HTTP gateways. Used both for downloads (fetchFile) and to
 * "publish" a file after adding it locally so other peers can fetch it
 * reliably even without a direct Helia bitswap peering.
 */
const IPFS_GATEWAYS = [
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
]

/**
 * Add raw bytes to the local Helia IPFS node and return its CID string.
 * Also kicks off a background "publish" to public gateways so the file is
 * reachable by other peers through the gateways — browser-to-browser Helia
 * bitswap is unreliable without direct libp2p peering, so this makes downloads
 * dependable. Callers should encrypt the bytes first (E2E).
 */
export async function addBytes(
  bytes: Uint8Array,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const node = await initIpfs()
  const ufs = unixfs(node)
  onProgress?.(0)
  const cid = await ufs.addBytes(bytes)
  const cidStr = cid.toString()
  onProgress?.(1)
  // Background-publish: ask a public gateway to fetch & cache the CID so it's
  // available to other peers. Best-effort, no await.
  publishToGateway(cidStr, bytes).catch(() => {})
  return cidStr
}

/**
 * Add a File to IPFS. Convenience wrapper around addBytes that reads the file
 * into a Uint8Array first.
 */
export async function addFile(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer())
  return addBytes(buf, onProgress)
}

/**
 * Best-effort: push the file content to a public IPFS gateway so it's cached
 * and downloadable by anyone. Tries gateways in order; resolves once one
 * returns 200 (or rejects if all fail).
 */
async function publishToGateway(cidStr: string, bytes: Uint8Array): Promise<void> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const url = gw + cidStr
      const resp = await fetch(url, { method: 'GET', redirect: 'follow' })
      if (resp.ok) return
    } catch {
      // try next gateway
    }
  }
}

/** Fetch a file's bytes from IPFS by CID string (via local Helia bitswap). */
export async function catFile(
  cidStr: string,
  size: number,
  onProgress?: (ratio: number) => void,
): Promise<Uint8Array> {
  const node = await initIpfs()
  const ufs = unixfs(node)
  const cid = CID.parse(cidStr)
  const chunks: Uint8Array[] = []
  let received = 0
  for await (const chunk of ufs.cat(cid)) {
    chunks.push(chunk)
    received += chunk.length
    if (size > 0) onProgress?.(Math.min(1, received / size))
  }
  onProgress?.(1)
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

/**
 * Fetch a file's bytes by CID, trying public IPFS gateways first (reliable),
 * then falling back to local Helia bitswap. Reports progress via onProgress.
 * Throws if all methods fail.
 */
export async function fetchFile(
  cidStr: string,
  size: number,
  onProgress?: (ratio: number) => void,
): Promise<Uint8Array> {
  // 1) Try public gateways (streaming with progress, 15s timeout each).
  for (const gw of IPFS_GATEWAYS) {
    try {
      const url = gw + cidStr
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15000)
      const resp = await fetch(url, { redirect: 'follow', signal: ctrl.signal })
      clearTimeout(timer)
      if (!resp.ok || !resp.body) continue
      const reader = resp.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          if (size > 0) onProgress?.(Math.min(1, received / size))
        }
      }
      if (received === 0) continue
      onProgress?.(1)
      const out = new Uint8Array(received)
      let offset = 0
      for (const c of chunks) {
        out.set(c, offset)
        offset += c.length
      }
      return out
    } catch {
      // timeout or error — try next gateway
    }
  }
  // 2) Fallback: local Helia bitswap.
  return catFile(cidStr, size, onProgress)
}

export async function stopIpfs() {
  if (helia) {
    try {
      await helia.stop()
    } catch {
      /* ignore */
    }
    helia = null
    fs = null
    initPromise = null
  }
}

/**
 * Pin a file to the IPFS network. Tries multiple approaches:
 * 1. Pin locally via Helia's pin API (keeps the block from GC).
 * 2. Upload the raw bytes to public IPFS gateways via PUT (some gateways
 *    accept this and cache/pin the content).
 * 3. Trigger a GET on public gateways (forces them to fetch via bitswap from
 *    our Helia node, caching the content).
 * Returns true if at least one method succeeded.
 */
export async function pinToNetwork(
  cidStr: string,
  bytes: Uint8Array,
  onProgress?: (ratio: number) => void,
): Promise<boolean> {
  onProgress?.(0)
  let success = false

  // 1) Add bytes to local Helia blockstore + pin.
  try {
    const node = await initIpfs()
    const ufs = unixfs(node)
    // Add the bytes to the local blockstore (creates the CID).
    const addedCid = await ufs.addBytes(bytes)
    const cidStr2 = addedCid.toString()
    if (cidStr2 === cidStr) {
      // Pin it so it won't be GC'd.
      for await (const _ of node.pins.add(addedCid)) { /* consume */ }
      log.info('ipfs', 'pinned locally via Helia', { cid: cidStr.slice(0, 10) })
      success = true
    } else {
      log.warn('ipfs', 'CID mismatch on re-add', { expected: cidStr.slice(0, 10), got: cidStr2.slice(0, 10) })
    }
  } catch (e) {
    console.error('Helia pin failed', e)
  }
  onProgress?.(0.3)

  // 2) Upload raw bytes to gateways that accept PUT.
  const PUT_GATEWAYS = [
    'https://dweb.link/ipfs/',
    'https://ipfs.io/ipfs/',
  ]
  for (const gw of PUT_GATEWAYS) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      const resp = await fetch(gw + cidStr, {
        method: 'PUT',
        body: bytes,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (resp.ok) {
        log.info('ipfs', 'pinned via PUT to gateway', { gateway: gw })
        success = true
        onProgress?.(1)
        return true
      }
    } catch {
      // try next
    }
  }
  onProgress?.(0.6)

  // 3) Trigger GET on gateways (forces bitswap fetch + cache).
  const GET_GATEWAYS = [
    'https://dweb.link/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ]
  for (const gw of GET_GATEWAYS) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15000)
      const resp = await fetch(gw + cidStr, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (resp.ok) {
        log.info('ipfs', 'cached via GET on gateway', { gateway: gw })
        success = true
        onProgress?.(1)
        return true
      }
    } catch {
      // try next
    }
  }
  onProgress?.(1)
  return success
}
