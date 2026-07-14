export interface PeerInfo {
  id: string
  name: string
  color: string
  joinedAt: number
  /** Last known call activity from this peer */
  media?: 'audio' | 'video' | 'none'
}

export interface FileMeta {
  cid: string
  name: string
  size: number
  mime: string
}

export type MessageKind = 'text' | 'file' | 'system'

export interface ChatMessage {
  id: string
  peerId: string
  name: string
  color: string
  kind: MessageKind
  text?: string
  file?: FileMeta
  time: number
  /** Whether the message was sent by the local user */
  self?: boolean
}

export interface Profile {
  name: string
  color: string
  room: string
}

export type CallState = 'idle' | 'audio' | 'video'

export type IpfsStatus = 'init' | 'ready' | 'error'

export interface Toast {
  id: string
  text: string
  kind: 'info' | 'success' | 'error'
}

/** Wire payload for the unified `msg` action. */
export interface WireMessage {
  id: string
  name: string
  color: string
  kind: MessageKind
  text?: string
  file?: FileMeta
  time: number
}

/** Wire payload for the `media` action. */
export interface WireMedia {
  event: 'start' | 'end'
  kind: 'audio' | 'video'
}
