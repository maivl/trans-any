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
 * Default IPFS HTTP gateways — used as fallback when the caller doesn't
 * provide a user-configured list. Both fetchFile and publishToGateway accept
 * an optional `gateways` parameter; when omitted these defaults are used.
 */
const DEFAULT_GATEWAYS = [
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
 *
 * @param gateways - Optional user-configured gateway list. If omitted, uses
 *   DEFAULT_GATEWAYS. The first entry is tried first.
 */
export async function addBytes(
  bytes: Uint8Array,
  onProgress?: (ratio: number) => void,
  gateways?: string[],
): Promise<string> {
  const node = await initIpfs()
  const ufs = unixfs(node)
  onProgress?.(0)
  const cid = await ufs.addBytes(bytes)
  const cidStr = cid.toString()
  onProgress?.(1)
  // Background-publish: ask gateways to fetch & cache the CID so it's
  // available to other peers. Best-effort, no await.
  publishToGateway(cidStr, bytes, gateways).catch(() => {})
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
 * Best-effort: fetch a CID from gateways to warm their cache so the file is
 * reachable by other peers. Tries gateways in configured order; resolves once
 * one returns 200 (or rejects if all fail).
 *
 * @param gateways - Optional user-configured list. Falls back to DEFAULT_GATEWAYS.
 */
async function publishToGateway(cidStr: string, bytes: Uint8Array, gateways?: string[]): Promise<void> {
  const list = gateways && gateways.length > 0 ? gateways : DEFAULT_GATEWAYS
  for (const gw of list) {
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
 *
 * @param gateways - Optional user-configured gateway list. When provided, the
 *   first entry is treated as the primary and tried first; the rest are raced
 *   in parallel alongside it. Falls back to DEFAULT_GATEWAYS.
 */
export async function fetchFile(
  cidStr: string,
  size: number,
  onProgress?: (ratio: number) => void,
  gateways?: string[],
): Promise<Uint8Array> {
  const gwList = gateways && gateways.length > 0 ? gateways : DEFAULT_GATEWAYS

  // 1) Try all configured gateways IN PARALLEL (race them). The first to
  //    respond wins. Sequential 15s timeouts × 4 gateways = up to 60s;
  //    parallel is at most 15s total and typically ~1-3s.
  const results = await Promise.allSettled(
    gwList.map(async (gw) => {
      const url = gw + cidStr
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15000)
      try {
        const resp = await fetch(url, { redirect: 'follow', signal: ctrl.signal })
        if (!resp.ok || !resp.body) throw new Error(`status ${resp.status}`)
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
        if (received === 0) throw new Error('empty response')
        clearTimeout(timer)
        onProgress?.(1)
        const out = new Uint8Array(received)
        let offset = 0
        for (const c of chunks) {
          out.set(c, offset)
          offset += c.length
        }
        return out
      } finally {
        clearTimeout(timer)
      }
    }),
  )
  // Return the first successful result.
  for (const r of results) {
    if (r.status === 'fulfilled') return r.value
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
 * Pin a file to the local Helia blockstore. This prevents the browser's IPFS
 * garbage collector from evicting the data while this tab is open.
 *
 * NOTE: True network-wide IPFS pinning (keeping data available for other peers
 * after this tab closes) is NOT possible from a browser environment. Public
 * IPFS gateways (dweb.link, ipfs.io, etc.) do NOT accept PUT pinning requests
 * and a GET fetch does NOT create a persistent pin. Only local Helia pinning
 * (preventing GC of the in-browser blockstore) is implemented here.
 * For persistent network pinning, use a dedicated pinning service (Pinata,
 * web3.storage, Filecoin) from a server-side client.
 *
 * Returns true if the local Helia pin succeeded.
 */
export async function pinToNetwork(
  cidStr: string,
  bytes: Uint8Array,
  onProgress?: (ratio: number) => void,
): Promise<boolean> {
  onProgress?.(0)
  onProgress?.(0.3)

  try {
    const node = await initIpfs()
    const ufs = unixfs(node)
    // Re-add bytes to the local blockstore (creates the CID — deterministic,
    // so same bytes → same CID).
    const addedCid = await ufs.addBytes(bytes)
    const cidStr2 = addedCid.toString()
    if (cidStr2 === cidStr) {
      // Pin it so the GC won't evict these blocks.
      for await (const _ of node.pins.add(addedCid)) { /* consume */ }
      log.info('ipfs', 'pinned locally via Helia', { cid: cidStr.slice(0, 10) })
      onProgress?.(1)
      return true
    } else {
      log.warn('ipfs', 'CID mismatch on re-add', { expected: cidStr.slice(0, 10), got: cidStr2.slice(0, 10) })
      onProgress?.(0.6)
      // Try fetching from IPFS as a fallback.
    }
  } catch (e) {
    console.error('Helia pin failed', e)
  }

  // Fallback: try to fetch the file from local Helia bitswap (if the blocks
  // are already in the blockstore from a previous addBytes call) and pin it.
  try {
    const node = await initIpfs()
    const cid = CID.parse(cidStr)
    // Check if blocks exist locally by attempting to resolve the CID.
    for await (const _ of node.pins.add(cid)) { /* consume */ }
    log.info('ipfs', 'pinned existing CID locally', { cid: cidStr.slice(0, 10) })
    onProgress?.(1)
    return true
  } catch {
    // Could not pin locally.
  }

  onProgress?.(1)
  return false
}
