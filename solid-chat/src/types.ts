export interface PeerInfo {
  id: string
  name: string
  color: string
  joinedAt: number
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
  self?: boolean
}

export interface Profile {
  name: string
  color: string
  room: string
  roomName: string
}

export type CallState = 'idle' | 'audio' | 'video'

export type IpfsStatus = 'init' | 'ready' | 'error'

export type ConnStatus = 'disconnected' | 'connecting' | 'connected'

export type Tab = 'files' | 'chat'

export interface Toast {
  id: string
  text: string
  kind: 'info' | 'success' | 'error'
}

/** A file transfer shown in the sidebar TRANSFERS section. */
export interface Transfer {
  id: string
  name: string
  size: number
  dir: 'send' | 'recv'
  peerName: string
  progress: number
  done: boolean
  time: number
}

/** A received file shown in the sidebar RECEIVED section. */
export interface ReceivedFile {
  id: string
  cid: string
  name: string
  size: number
  mime: string
  from: string
  time: number
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

/** Wire payload for the `profile` action. */
export interface WireProfile {
  name: string
  color: string
}
