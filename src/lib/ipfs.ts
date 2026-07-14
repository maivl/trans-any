import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { CID } from 'multiformats/cid'
import type { Helia } from 'helia'

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

/** Add a File to IPFS and return its CID string. */
export async function addFile(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const node = await initIpfs()
  const ufs = unixfs(node)
  onProgress?.(0)
  const buf = new Uint8Array(await file.arrayBuffer())
  const cid = await ufs.addBytes(buf)
  onProgress?.(1)
  return cid.toString()
}

/** Fetch a file's bytes from IPFS by CID string. */
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
