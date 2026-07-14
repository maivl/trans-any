import { joinRoom, getRelaySockets } from 'trystero'
import type { PeerInfo, ChatMessage, WireMessage, WireMedia, WireProfile, Profile } from '../types'
import { colorFromId, randomId } from './utils'
import { log } from './debug'

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
}

const APP_ID = 'zai-trystero-p2p-chat-v1'

/**
 * Curated, known-reliable Nostr relays used for signaling. A broad set
 * maximizes the chance both peers share at least one working relay even if
 * some are blocked or rate-limited on their network. damus is excluded
 * (aggressively rate-limits Trystero's announces).
 */
const RELAY_URLS = [
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

/** STUN servers for reflexive ICE candidates. */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
}

export function createChat(
  profile: Profile,
  handlers: ChatHandlers,
): ChatController {
  const selfId = randomId()
  const config = {
    appId: APP_ID,
    rtcConfig: RTC_CONFIG,
    relayConfig: { urls: RELAY_URLS },
  } as Record<string, unknown>

  log.info('chat', 'joining room', { room: profile.room, name: profile.name, relays: RELAY_URLS.length })

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

  const sendMessage = (m: ChatMessage) => {
    const wire: WireMessage = {
      id: m.id,
      name: m.name,
      color: m.color,
      kind: m.kind,
      text: m.text,
      file: m.file,
      time: m.time,
    }
    msgAction.send(wire).catch((e) => log.error('msg', 'send failed', e))
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
    handlers.onProfile({
      id: context.peerId,
      name: data.name || 'Anonymous',
      color: data.color || colorFromId(context.peerId),
      joinedAt: Date.now(),
      media: 'none',
    })
  }

  // Incoming messages
  msgAction.onMessage = (data, context) => {
    log.ok('msg', 'received', { from: context.peerId, kind: data.kind })
    handlers.onMessage({
      id: data.id,
      peerId: context.peerId,
      name: data.name,
      color: data.color,
      kind: data.kind,
      text: data.text,
      file: data.file,
      time: data.time,
    })
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
    leave,
  }
}
