/**
 * Debug logger for the P2P pairing layer.
 *
 * Every log call goes to the console AND into an in-memory ring buffer that
 * the UI's debug panel subscribes to — so users can see exactly why pairing
 * is (or isn't) working: relay connections, presence announces, peer-join,
 * ICE gathering/state, data-channel open, etc.
 */

export type DebugLevel = 'info' | 'ok' | 'warn' | 'error'

export interface DebugEntry {
  id: number
  t: number
  level: DebugLevel
  tag: string
  text: string
}

const MAX = 500
let buffer: DebugEntry[] = []
let seq = 0
type Listener = (entries: DebugEntry[]) => void
const listeners = new Set<Listener>()

export function getDebugLog(): DebugEntry[] {
  return buffer.slice()
}

export function clearDebugLog(): void {
  buffer = []
  emit()
}

export function subscribeDebug(fn: Listener): () => void {
  listeners.add(fn)
  fn(buffer.slice())
  return () => listeners.delete(fn)
}

function emit() {
  const snap = buffer.slice()
  listeners.forEach((l) => {
    try {
      l(snap)
    } catch {
      /* ignore */
    }
  })
}

const LEVEL_STYLE: Record<DebugLevel, string> = {
  info: 'color:#3b82f6',
  ok: 'color:#10b981',
  warn: 'color:#f59e0b',
  error: 'color:#ef4444',
}

export function debug(level: DebugLevel, tag: string, text: string, extra?: unknown): void {
  const entry: DebugEntry = {
    id: ++seq,
    t: Date.now(),
    level,
    tag,
    text: extra !== undefined ? `${text} ${safeStringify(extra)}` : text,
  }
  buffer.push(entry)
  if (buffer.length > MAX) buffer = buffer.slice(-MAX)
  // Console output (grouped, colored).
  const time = new Date(entry.t).toLocaleTimeString()
  const css = LEVEL_STYLE[level]
  // eslint-disable-next-line no-console
  console.log(`%c[${tag}]`, css, `${time} ${text}`, extra !== undefined ? extra : '')
  emit()
}

function safeStringify(v: unknown): string {
  try {
    if (v instanceof Error) return v.message
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export const log = {
  info: (tag: string, text: string, extra?: unknown) => debug('info', tag, text, extra),
  ok: (tag: string, text: string, extra?: unknown) => debug('ok', tag, text, extra),
  warn: (tag: string, text: string, extra?: unknown) => debug('warn', tag, text, extra),
  error: (tag: string, text: string, extra?: unknown) => debug('error', tag, text, extra),
}
