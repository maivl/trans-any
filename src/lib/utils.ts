/** Small utility helpers shared across the app. */

import { loadSettings } from './chat'

const PALETTE = [
  '#0ea5e9', '#f43f5e', '#f59e0b', '#8b5cf6', '#10b981',
  '#ec4899', '#14b8a6', '#6366f1', '#eab308', '#06b6d4',
]

const ROOM_WORDS_A = [
  'Forest', 'Ocean', 'Amber', 'Crimson', 'Velvet', 'Northern', 'Quiet', 'Silver',
  'Lunar', 'Ember', 'Cobalt', 'Golden', 'Hidden', 'Distant', 'Bright', 'Still',
  'Wild', 'Coral', 'Onyx', 'Aurora',
]
const ROOM_WORDS_B = [
  'Star', 'Tide', 'Grove', 'Meadow', 'Echo', 'Spark', 'Drift', 'Hollow',
  'Frost', 'Glow', 'Pine', 'Cedar', 'Wave', 'Peak', 'Field', 'Reef',
  'Lark', 'Bay', 'Mist', 'Shore',
]

/** A pool of friendly random display names. */
const NAME_POOL = [
  'Falcon', 'Maple', 'Nova', 'River', 'Sage', 'Wren', 'Onyx', 'Lumen',
  'Pixel', 'Quartz', 'Indigo', 'Hazel', 'Cobalt', 'Juniper', 'Echo', 'Vesper',
  'Atlas', 'Briar', 'Cedar', 'Dune', 'Fern', 'Glint', 'Haven', 'Iris',
]

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function randomRoomCode(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/** A poetic two-word room name, e.g. "Forest Star". */
export function randomRoomName(): string {
  const a = ROOM_WORDS_A[Math.floor(Math.random() * ROOM_WORDS_A.length)]
  const b = ROOM_WORDS_B[Math.floor(Math.random() * ROOM_WORDS_B.length)]
  return `${a} ${b}`
}

/** A random friendly display name, optionally suffixed to reduce collisions. */
export function randomName(): string {
  const base = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]
  const suffix = Math.floor(Math.random() * 90 + 10)
  return `${base}${suffix}`
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
  const settings = loadSettings()
  const first = settings.gateways[0] || 'https://dweb.link/ipfs/'
  const base = first.endsWith('/') ? first : first + '/'
  return base + cid
}

/** Map a MIME type to an icon key (used by the Icon component). */
export function fileIconKey(mime: string): string {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'film'
  if (mime.startsWith('audio/')) return 'music'
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('zip') || mime.includes('compressed')) return 'archive'
  return 'doc'
}
