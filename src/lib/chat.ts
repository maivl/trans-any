import { joinRoom, getRelaySockets } from 'trystero'
import type { PeerInfo, ChatMessage, WireMessage, WireMedia, WireProfile, Profile } from '../types'
import { colorFromId, randomId } from './utils'
import { log } from './debug'
import { encryptText, decryptText, encryptBytes, decryptBytes, type CryptoKeyLike } from './crypto'

type RoomHandle = ReturnType<typeof joinRoom>

export interface SignalingInfo {
  open: number
  total: number
}

export interface ChatController {
  room: RoomHandle
  selfId: string
  /** Broadcast profile to all peers (or a specific one). */
  announceProfile: (to?: string) => void
  /** Send a chat message (text or file) to all peers. */
  sendMessage: (m: ChatMessage) => void
  /** Broadcast a media lifecycle event. */
  sendMedia: (m: WireMedia, to?: string[]) => void
  /** Start streaming a media stream (audio and/or video) to all peers. */
  addStream: (stream: MediaStream) => void
  /** Stop streaming a media stream. */
  removeStream: (stream: MediaStream) => void
  /** Current signaling-relay connection count (open / total). */
  getSignalingInfo: () => SignalingInfo
  /** Snapshot of current peer RTCPeerConnection ICE states. */
  getPeerStates: () => Record<string, { ice: string; conn: string }>
  /** Approval: joiner requests to join; creator approves/denies. */
  sendJoinRequest: (to: string) => void
  sendApproval: (peerId: string, approved: boolean) => void
  /** Send the E2E room key to an approved joiner (creator side). */
  sendRoomKey: (peerId: string, keyB64: string) => void
  /** Send encrypted file bytes (chunked) over the WebRTC data channel. */
  sendFileChunk: (to: string, chunk: { cid: string; index: number; total: number; data: string }) => Promise<void>
  /** Request file bytes from a peer over WebRTC (CID → encrypted base64). */
  sendFileRequest: (to: string, cid: string) => void
  sendSettings: (gateways: string[], relays: string[]) => void
  removePeer: (peerId: string) => void
  leave: () => void
}

export interface ChatHandlers {
  onPeerJoin: (peer: PeerInfo) => void
  onPeerLeave: (peerId: string) => void
  onProfile: (peer: PeerInfo) => void
  onMessage: (msg: ChatMessage) => void
  onMedia: (peerId: string, media: WireMedia) => void
  onStream: (stream: MediaStream, peerId: string) => void
  /** Signaling discovered a peer; WebRTC handshake starting (not yet connected). */
  onPeerHandshake?: (peerId: string) => void
  /** WebRTC handshake/ICE failed for a peer. */
  onJoinError?: (details: { error: string; peerId: string }) => void
  /** A joiner sent a join request (creator side). */
  onJoinRequest?: (peerId: string, profile: WireProfile) => void
  /** The creator responded to our join request (joiner side). */
  onApproval?: (peerId: string, approved: boolean) => void
  /** The creator sent us the E2E room key (joiner side). */
  onRoomKey?: (peerId: string, keyB64: string) => void
  /** A peer sent a chunk of encrypted file bytes (WebRTC fallback for download). */
  onFileChunk?: (peerId: string, chunk: { cid: string; index: number; total: number; data: string }) => void
  /** A peer is requesting file bytes by CID (sender side — respond via sendFileChunk). */
  onFileRequest?: (peerId: string, cid: string) => void
}

const APP_ID = 'zai-trystero-p2p-chat-v1'

/**
 * Curated, known-reliable Nostr relays used for signaling. A broad set
 * maximizes the chance both peers share at least one working relay even if
 * some are blocked or rate-limited on their network. damus is excluded
 * (aggressively rate-limits Trystero's announces).
 */
export const DEFAULT_RELAY_URLS = [
  'wss://nos.lol',
  'wss://relay.nostrdice.com',
  'wss://nostr.data.haus',
  'wss://relay.mostr.pub',
  'wss://nostr-01.yakihonne.com',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://nostr.mom',
  'wss://relay.nostr.net',
]

export const DEFAULT_GATEWAY_URLS = [
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
]

const SETTINGS_KEY = 'fybeam-settings'

export interface SavedSettings {
  gateways: string[]
  relays: string[]
  firstGateway: string
  firstRelay: string
}

export function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const gateways = parsed.gateways?.length ? parsed.gateways : DEFAULT_GATEWAY_URLS
      const relays = parsed.relays?.length ? parsed.relays : DEFAULT_RELAY_URLS
      return {
        gateways,
        relays,
        firstGateway: parsed.firstGateway || gateways[0] || '',
        firstRelay: parsed.firstRelay || relays[0] || '',
      }
    }
  } catch { /* ignore */ }
  return {
    gateways: DEFAULT_GATEWAY_URLS,
    relays: DEFAULT_RELAY_URLS,
    firstGateway: DEFAULT_GATEWAY_URLS[0],
    firstRelay: DEFAULT_RELAY_URLS[0],
  }
}

export function saveSettings(gateways: string[], relays: string[], firstGateway?: string, firstRelay?: string) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      gateways,
      relays,
      firstGateway: firstGateway || gateways[0] || '',
      firstRelay: firstRelay || relays[0] || '',
    }))
  } catch { /* ignore */ }
}

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// TURN support removed — files travel via IPFS gateways (encrypted), text via
// the WebRTC data channel. For cross-network NAT traversal, add a TURN server
// to STUN_SERVERS and pass it through rtcConfig.

/** Build the RTCConfiguration with STUN servers. */
function buildRtcConfig(): RTCConfiguration {
  log.info('ice', 'ICE servers (STUN)', { stun: STUN_SERVERS.length })
  return {
    iceServers: [...STUN_SERVERS],
    iceTransportPolicy: 'all',
  }
}

export function createChat(
  profile: Profile,
  handlers: ChatHandlers,
  getRoomKey?: () => CryptoKeyLike | null,
): ChatController {
  const selfId = randomId()
  const roomKey = () => (getRoomKey ? getRoomKey() : null)
  const settings = loadSettings()
  const config = {
    appId: APP_ID,
    rtcConfig: buildRtcConfig(),
    relayConfig: { urls: settings.relays },
  } as Record<string, unknown>

  log.info('chat', 'joining room', { room: profile.room, name: profile.name, relays: settings.relays.length })

  // JoinRoomCallbacks (3rd arg): onPeerHandshake fires when signaling
  // discovers a peer (before the WebRTC data channel opens); onJoinError fires
  // when the handshake/ICE fails — this is the key signal for "why no pairing".
  const callbacks = {
    onPeerHandshake: (peerId: string) => {
      log.ok('handshake', 'peer discovered via signaling (starting WebRTC)', { peerId })
      handlers.onPeerHandshake?.(peerId)
    },
    onJoinError: (details: { error: string; appId: string; roomId: string; peerId: string }) => {
      log.error('handshake', 'JOIN ERROR (ICE/handshake failed)', details)
      handlers.onJoinError?.({ error: details.error, peerId: details.peerId })
    },
    handshakeTimeoutMs: 30000,
  }

  const room = joinRoom(config as never, profile.room, callbacks as never)

  // Trystero v0.25: makeAction returns an object with `.send` and `.onMessage`.
  const profileAction = room.makeAction<WireProfile>('profile')
  const msgAction = room.makeAction<WireMessage>('msg')
  const mediaAction = room.makeAction<WireMedia>('media')
  // Approval actions: joiner → creator (request), creator → joiner (decision).
  const joinReqAction = room.makeAction<WireProfile>('join-request')
  const approvalAction = room.makeAction<{ approved: boolean }>('approval')
  // Room-key exchange: creator → approved joiner (E2E encryption key).
  const keyAction = room.makeAction<{ key: string }>('room-key')
  // File-bytes exchange (WebRTC fallback for downloads when IPFS gateways
  // can't reach the sender's browser Helia node).
  const fileChunkAction = room.makeAction<{ cid: string; index: number; total: number; data: string }>('file-chunk')
  // File-bytes request: receiver → sender (ask for file bytes over WebRTC).
  const fileReqAction = room.makeAction<{ cid: string }>('file-request')

  // Watch relay sockets come online (signaling transport readiness).
  try {
    const sockets = getRelaySockets() as Record<string, { readyState?: number; addEventListener?: (e: string, cb: () => void) => void }>
    Object.entries(sockets).forEach(([url, sock]) => {
      const check = () => {
        const open = sock.readyState === 1
        log.info('relay', open ? 'connected' : 'state', { url, readyState: sock.readyState })
      }
      check()
      sock.addEventListener?.('open', () => log.ok('relay', 'connected', { url }))
      sock.addEventListener?.('error', () => log.error('relay', 'error', { url }))
      sock.addEventListener?.('close', () => log.warn('relay', 'closed', { url }))
    })
  } catch (e) {
    log.warn('relay', 'could not introspect sockets', e)
  }

  const announceProfile = (to?: string) => {
    log.info('profile', 'announce', to ? { to } : 'broadcast')
    profileAction
      .send({ name: profile.name, color: profile.color }, to ? { target: to } : undefined)
      .then(() => log.ok('profile', 'announce sent', to ? { to } : 'broadcast'))
      .catch((e) => log.error('profile', 'announce failed', e))
  }

  const sendMessage = async (m: ChatMessage) => {
    // E2E encrypt text and file CID if a room key is present.
    let encText = m.text
    let encFile = m.file
    if (roomKey()) {
      try {
        if (m.text) encText = await encryptText(roomKey(), m.text)
        if (m.file) {
          // Encrypt the CID so only key-holders can fetch the right file.
          const encCid = await encryptText(roomKey(), m.file.cid)
          encFile = { ...m.file, cid: encCid }
        }
      } catch (e) {
        log.error('crypto', 'encrypt failed, sending plaintext', e)
      }
    }
    const wire: WireMessage = {
      id: m.id,
      name: m.name,
      color: m.color,
      kind: m.kind,
      text: encText,
      file: encFile,
      time: m.time,
    }
    msgAction.send(wire).catch((e) => log.error('msg', 'send failed', e))
  }

  const sendSettings = (gateways: string[], relays: string[]) => {
    msgAction.send({
      id: randomId(),
      name: profile.name,
      color: profile.color,
      kind: 'settings',
      text: JSON.stringify({ gateways, relays }),
      time: Date.now(),
    }).catch(() => {})
  }

  const sendMedia = (m: WireMedia, to?: string[]) => {
    mediaAction.send(m, to ? { target: to } : undefined).catch((e) => log.error('media', 'send failed', e))
  }

  /** Attach ICE/connection-state logging to a peer's RTCPeerConnection. */
  const watchPeerPc = (peerId: string) => {
    try {
      const peers = (room as unknown as { getPeers?: () => Record<string, RTCPeerConnection> }).getPeers?.()
      const pc = peers?.[peerId]
      if (!pc) {
        log.warn('ice', 'no RTCPeerConnection for peer', { peerId })
        return
      }
      log.info('ice', 'watching peer pc', { peerId, signaling: pc.signalingState, ice: pc.iceConnectionState, conn: pc.connectionState })
      const summarize = (ev: Event) => {
        const t = ev.type
        // candidate dump
        if (t === 'icecandidate' && ev instanceof RTCPeerConnectionIceEvent && ev.candidate) {
          const c = ev.candidate.candidate
          const typ = c.includes('typ host') ? 'host' : c.includes('typ srflx') ? 'srflx' : c.includes('typ relay') ? 'relay' : c.includes('typ prflx') ? 'prflx' : 'other'
          log.info('ice', `candidate (${typ})`, { peerId, candidate: c })
        } else if (t === 'icegatheringstatechange') {
          log.info('ice', 'gathering', { peerId, state: pc.iceGatheringState })
        } else if (t === 'iceconnectionstatechange') {
          log.info('ice', 'ice state', { peerId, state: pc.iceConnectionState })
        } else if (t === 'connectionstatechange') {
          log.info('ice', 'conn state', { peerId, state: pc.connectionState })
        } else if (t === 'signalingstatechange') {
          log.info('ice', 'signaling', { peerId, state: pc.signalingState })
        } else if (t === 'datachannel') {
          log.ok('ice', 'datachannel open', { peerId })
        } else if (t === 'track') {
          log.ok('ice', 'track received', { peerId })
        }
      }
      ;[
        'icecandidate',
        'icegatheringstatechange',
        'iceconnectionstatechange',
        'connectionstatechange',
        'signalingstatechange',
        'datachannel',
        'track',
      ].forEach((ev) => pc.addEventListener(ev, summarize))
    } catch (e) {
      log.warn('ice', 'could not attach watchers', e)
    }
  }

  // Trystero v0.25: presence events are assignable properties.
  room.onPeerJoin = (peerId: string) => {
    log.ok('presence', 'peer join', { peerId })
    // Send our profile to the newly joined peer so they know who we are.
    announceProfile(peerId)
    handlers.onPeerJoin({
      id: peerId,
      name: '…',
      color: colorFromId(peerId),
      joinedAt: Date.now(),
      media: 'none',
    })
    // Attach ICE debug watchers on the new peer's RTCPeerConnection.
    watchPeerPc(peerId)
  }

  room.onPeerLeave = (peerId: string) => {
    log.warn('presence', 'peer leave', { peerId })
    handlers.onPeerLeave(peerId)
  }

  // Incoming profiles
  profileAction.onMessage = (data, context) => {
    log.ok('profile', 'received', { from: context.peerId, name: data.name })
    if (typeof handlers.onProfile !== 'function') {
      log.error('profile', 'handlers.onProfile is not a function!', { type: typeof handlers.onProfile })
      return
    }
    handlers.onProfile({
      id: context.peerId,
      name: data.name || 'Anonymous',
      color: data.color || colorFromId(context.peerId),
      joinedAt: Date.now(),
      media: 'none',
    })
  }

  // Incoming messages — decrypt text and file CID if a room key is present.
  msgAction.onMessage = async (data, context) => {
    log.ok('msg', 'received', { from: context.peerId, kind: data.kind })
    let text = data.text
    let file = data.file
    if (roomKey()) {
      try {
        if (data.text) text = await decryptText(roomKey(), data.text)
        if (data.file) {
          const decCid = await decryptText(roomKey(), data.file.cid)
          file = { ...data.file, cid: decCid }
        }
      } catch (e) {
        log.error('crypto', 'decrypt failed', e)
      }
    }
    handlers.onMessage({
      id: data.id,
      peerId: context.peerId,
      name: data.name,
      color: data.color,
      kind: data.kind,
      text,
      file,
      time: data.time,
    })
  }

  // Incoming room key (joiner receives from creator after approval).
  keyAction.onMessage = (data, context) => {
    log.ok('crypto', 'room key received', { from: context.peerId })
    handlers.onRoomKey?.(context.peerId, data.key)
  }

  // Incoming file chunk (WebRTC fallback for file downloads).
  fileChunkAction.onMessage = (data, context) => {
    handlers.onFileChunk?.(context.peerId, data)
  }

  // Incoming file request — a peer wants us to send file bytes over WebRTC.
  fileReqAction.onMessage = (data, context) => {
    log.info('file', 'request received', { from: context.peerId, cid: data.cid.slice(0, 8) })
    handlers.onFileRequest?.(context.peerId, data.cid)
  }

  // Incoming media control events
  mediaAction.onMessage = (data, context) => {
    log.info('media', 'event', { from: context.peerId, event: data.event, kind: data.kind })
    handlers.onMedia(context.peerId, data)
  }

  // Incoming media streams (audio/video tracks)
  room.onPeerStream = (stream: MediaStream, peerId: string) => {
    log.ok('media', 'stream received', { peerId, tracks: stream.getTracks().length })
    handlers.onStream(stream, peerId)
  }

  // Approval: joiner → creator (request to join)
  joinReqAction.onMessage = (data, context) => {
    log.info('approval', 'join request received', { from: context.peerId, name: data.name })
    handlers.onJoinRequest?.(context.peerId, data)
  }
  // Approval: creator → joiner (decision)
  approvalAction.onMessage = (data, context) => {
    log.info('approval', 'decision received', { from: context.peerId, approved: data.approved })
    handlers.onApproval?.(context.peerId, data.approved)
  }

  const sendJoinRequest = (to: string) => {
    log.info('approval', 'sending join request', { to })
    joinReqAction.send({ name: profile.name, color: profile.color }, { target: to }).catch((e) => log.error('approval', 'join request send failed', e))
  }
  const sendApproval = (peerId: string, approved: boolean) => {
    log.info('approval', 'sending decision', { to: peerId, approved })
    approvalAction.send({ approved }, { target: peerId }).catch((e) => log.error('approval', 'decision send failed', e))
  }
  const sendRoomKey = (peerId: string, keyB64: string) => {
    log.info('crypto', 'sending room key', { to: peerId })
    keyAction.send({ key: keyB64 }, { target: peerId }).catch((e) => log.error('crypto', 'key send failed', e))
  }
  const sendFileChunk = async (to: string, chunk: { cid: string; index: number; total: number; data: string }) => {
    try {
      await fileChunkAction.send(chunk, { target: to })
    } catch (e) {
      log.error('file', 'chunk send failed', e)
    }
  }
  const sendFileRequest = (to: string, cid: string) => {
    log.info('file', 'requesting file via WebRTC', { to, cid: cid.slice(0, 8) })
    fileReqAction.send({ cid }, { target: to }).catch((e) => log.error('file', 'request send failed', e))
  }
  const removePeer = (peerId: string) => {
    try {
      // Trystero v0.25 exposes getPeers(); closing the RTCPeerConnection drops
      // the peer. There's no public "kick" API, so we close the PC directly.
      const peers = (room as unknown as { getPeers?: () => Record<string, RTCPeerConnection> }).getPeers?.()
      const pc = peers?.[peerId]
      if (pc) {
        log.info('approval', 'removing peer', { peerId })
        pc.close()
      }
    } catch (e) {
      log.warn('approval', 'could not remove peer', e)
    }
  }

  const addStream = (stream: MediaStream) => {
    log.info('media', 'addStream', { tracks: stream.getTracks().length })
    room.addStream(stream)
  }
  const removeStream = (stream: MediaStream) => {
    log.info('media', 'removeStream')
    room.removeStream(stream)
  }

  const leave = () => {
    log.info('chat', 'leaving room')
    try {
      void room.leave()
    } catch {
      /* ignore */
    }
  }

  const getSignalingInfo = (): SignalingInfo => {
    try {
      const sockets = Object.values(getRelaySockets()) as { readyState?: number }[]
      const total = sockets.length
      const open = sockets.filter((s) => s && s.readyState === 1).length
      return { open, total }
    } catch {
      return { open: 0, total: 0 }
    }
  }

  const getPeerStates = (): Record<string, { ice: string; conn: string }> => {
    try {
      const peers = (room as unknown as { getPeers?: () => Record<string, RTCPeerConnection> }).getPeers?.() ?? {}
      const out: Record<string, { ice: string; conn: string }> = {}
      for (const [id, pc] of Object.entries(peers)) {
        out[id] = { ice: pc.iceConnectionState, conn: pc.connectionState }
      }
      return out
    } catch {
      return {}
    }
  }

  // Announce ourselves to anyone already in the room.
  announceProfile()

  log.ok('chat', 'room joined', { selfId, room: profile.room })

  return {
    room,
    selfId,
    announceProfile,
    sendMessage,
    sendMedia,
    addStream,
    removeStream,
    getSignalingInfo,
    getPeerStates,
    sendJoinRequest,
    sendApproval,
    sendRoomKey,
    sendFileChunk,
    sendFileRequest,
    sendSettings,
    removePeer,
    leave,
  }
}
