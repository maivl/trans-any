/** Small utility helpers shared across the app. */

const PALETTE = [
  '#10b981', '#f43f5e', '#f59e0b', '#a855f7', '#06b6d4',
  '#84cc16', '#ec4899', '#14b8a6', '#eab308', '#8b5cf6',
]

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/** Deterministic color for a given id. */
export function colorFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return PALETTE[h % PALETTE.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export function shortCid(cid: string): string {
  if (cid.length <= 14) return cid
  return `${cid.slice(0, 6)}…${cid.slice(-4)}`
}

export function gatewayUrl(cid: string): string {
  return `https://dweb.link/ipfs/${cid}`
}

/** Clamp helper. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
