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

export const [transfers, setTransfers] = createSignal<Transfer[]>([])
export const [received, setReceived] = createSignal<ReceivedFile[]>([])

export const [toasts, setToasts] = createSignal<Toast[]>([])

export function pushToast(text: string, kind: Toast['kind'] = 'info') {
  const id = Math.random().toString(36).slice(2)
  setToasts((t) => [...t, { id, text, kind }])
  setTimeout(() => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, 3600)
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
  setTransfers([])
  setReceived([])
  setTab('chat')
}
