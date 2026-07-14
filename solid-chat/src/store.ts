import { createSignal } from 'solid-js'
import type { PeerInfo, ChatMessage, CallState, IpfsStatus, Toast } from './types'

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

export const [connected, setConnected] = createSignal(false)
export const [selfId, setSelfId] = createSignal<string>('')

export const [toasts, setToasts] = createSignal<Toast[]>([])

export function pushToast(text: string, kind: Toast['kind'] = 'info') {
  const id = Math.random().toString(36).slice(2)
  setToasts((t) => [...t, { id, text, kind }])
  setTimeout(() => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, 3600)
}

export function resetStore() {
  setPeers({})
  setMessages([])
  setRemoteStreams({})
  setLocalStream(null)
  setCallState('idle')
  setMicEnabled(true)
  setCamEnabled(true)
  setConnected(false)
}
