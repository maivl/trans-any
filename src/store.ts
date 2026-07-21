import { createSignal } from 'solid-js'
import type {
  PeerInfo,
  ChatMessage,
  CallState,
  IpfsStatus,
  Toast,
  Transfer,
  ReceivedFile,
  Tab,
  ConnStatus,
} from './types'

/** Global reactive store built on Solid signals. */

export const [peers, setPeers] = createSignal<Record<string, PeerInfo>>({})
export const [messages, setMessages] = createSignal<ChatMessage[]>([])
export const [remoteStreams, setRemoteStreams] = createSignal<Record<string, MediaStream>>({})
export const [localStream, setLocalStream] = createSignal<MediaStream | null>(null)
export const [callState, setCallState] = createSignal<CallState>('idle')
export const [micEnabled, setMicEnabled] = createSignal(true)
export const [camEnabled, setCamEnabled] = createSignal(true)

export const [ipfsStatus, setIpfsStatus] = createSignal<IpfsStatus>('init')
export const [ipfsNodeId, setIpfsNodeId] = createSignal<string>('')

export const [connStatus, setConnStatus] = createSignal<ConnStatus>('connecting')
export const [selfId, setSelfId] = createSignal<string>('')

export const [signaling, setSignaling] = createSignal<{ open: number; total: number }>({ open: 0, total: 0 })
/** True after the user has waited a while with no peer joining. */
export const [waitingLong, setWaitingLong] = createSignal(false)

export const [tab, setTab] = createSignal<Tab>('chat')

/** Role: 'creator' (host, approves joiners) or 'joiner' (requests to join). */
export type Role = 'creator' | 'joiner'
export const [role, setRole] = createSignal<Role>('creator')

/** Joiner-side: approval state for the creator's decision. */
export type ApprovalState = 'requesting' | 'approved' | 'denied'
export const [approvalState, setApprovalState] = createSignal<ApprovalState | null>(null)

/** Creator-side: pending join requests { peerId, name, color, time }. */
export interface PendingRequest { peerId: string; name: string; color: string; time: number }
export const [pendingRequests, setPendingRequests] = createSignal<PendingRequest[]>([])

export const [transfers, setTransfers] = createSignal<Transfer[]>([])
export const [received, setReceived] = createSignal<ReceivedFile[]>([])

export const [toasts, setToasts] = createSignal<Toast[]>([])

/** Toast lookup: key = `${kind}::${text}`. Each timer is keyed by id. */
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Push a toast. If the same text+kind already exists, merge (increment
 *  count + reset auto-dismiss timer) instead of duplicating. */
export function pushToast(text: string, kind: Toast['kind'] = 'info') {
  const key = `${kind}::${text}`

  setToasts((t) => {
    const existing = t.find((x) => `${x.kind}::${x.text}` === key)
    if (existing) {
      // Merge: increment count, reset its auto-dismiss timer.
      const oldTimer = toastTimers.get(existing.id)
      if (oldTimer) clearTimeout(oldTimer)
      const newTimer = setTimeout(() => {
        setToasts((t2) => t2.filter((x) => x.id !== existing.id))
        toastTimers.delete(existing.id)
      }, 3600)
      toastTimers.set(existing.id, newTimer)
      return t.map((x) => (x.id === existing.id ? { ...x, count: x.count + 1 } : x))
    }

    // New toast.
    const id = Math.random().toString(36).slice(2)
    const timer = setTimeout(() => {
      setToasts((t2) => t2.filter((x) => x.id !== id))
      toastTimers.delete(id)
    }, 3600)
    toastTimers.set(id, timer)
    return [...t, { id, text, kind, count: 1 }]
  })
}

export function addTransfer(t: Transfer) {
  setTransfers((s) => [t, ...s])
}

export function updateTransfer(id: string, patch: Partial<Transfer>) {
  setTransfers((s) => s.map((t) => (t.id === id ? { ...t, ...patch } : t)))
}

export function addReceived(f: ReceivedFile) {
  setReceived((s) => [f, ...s])
}

export function resetStore() {
  setPeers({})
  setMessages([])
  setRemoteStreams({})
  setLocalStream(null)
  setCallState('idle')
  setMicEnabled(true)
  setCamEnabled(true)
  setConnStatus('connecting')
  setSignaling({ open: 0, total: 0 })
  setWaitingLong(false)
  setRole('creator')
  setApprovalState(null)
  setPendingRequests([])
  setTransfers([])
  setReceived([])
  setTab('chat')
}
