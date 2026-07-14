import { joinRoom } from 'trystero'
import type { PeerInfo, ChatMessage, WireMessage, WireMedia, WireProfile, Profile } from '../types'
import { colorFromId, randomId } from './utils'

type RoomHandle = ReturnType<typeof joinRoom>

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
  leave: () => void
}

export interface ChatHandlers {
  onPeerJoin: (peer: PeerInfo) => void
  onPeerLeave: (peerId: string) => void
  onProfile: (peer: PeerInfo) => void
  onMessage: (msg: ChatMessage) => void
  onMedia: (peerId: string, media: WireMedia) => void
  onStream: (stream: MediaStream, peerId: string) => void
}

const APP_ID = 'zai-trystero-p2p-chat-v1'

/**
 * Curated, known-reliable Nostr relays used for signaling. Trystero's default
 * picks a deterministic subset of 5 from a long list (some flaky); pinning a
 * hand-picked set maximizes the chance both peers share healthy relays.
 */
const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostrdice.com',
  'wss://nostr.data.haus',
  'wss://relay.mostr.pub',
  'wss://nostr-01.yakihonne.com',
]

/** STUN servers for reflexive ICE candidates. */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

export function createChat(
  profile: Profile,
  handlers: ChatHandlers,
): ChatController {
  const selfId = randomId()
  // `relayConfig.urls` is read by Trystero's getRelays (not in the TS types),
  // so we cast to pass a curated relay list.
  const config = {
    appId: APP_ID,
    rtcConfig: RTC_CONFIG,
    relayConfig: { urls: RELAY_URLS },
  } as Record<string, unknown>
  console.log('[trystero] joining room', profile.room, 'as', profile.name)
  const room = joinRoom(config as never, profile.room)

  // Trystero v0.25: makeAction returns an object with `.send` and `.onMessage`.
  const profileAction = room.makeAction<WireProfile>('profile')
  const msgAction = room.makeAction<WireMessage>('msg')
  const mediaAction = room.makeAction<WireMedia>('media')

  const announceProfile = (to?: string) => {
    profileAction
      .send({ name: profile.name, color: profile.color }, to ? { target: to } : undefined)
      .catch(() => {})
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
    msgAction.send(wire).catch(() => {})
  }

  const sendMedia = (m: WireMedia, to?: string[]) => {
    mediaAction.send(m, to ? { target: to } : undefined).catch(() => {})
  }

  // Trystero v0.25: presence events are assignable properties.
  room.onPeerJoin = (peerId: string) => {
    console.log('[trystero] peer join', peerId)
    // Send our profile to the newly joined peer so they know who we are.
    announceProfile(peerId)
    handlers.onPeerJoin({
      id: peerId,
      name: '…',
      color: colorFromId(peerId),
      joinedAt: Date.now(),
      media: 'none',
    })
  }

  room.onPeerLeave = (peerId: string) => {
    console.log('[trystero] peer leave', peerId)
    handlers.onPeerLeave(peerId)
  }

  // Incoming profiles
  profileAction.onMessage = (data, context) => {
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
    handlers.onMedia(context.peerId, data)
  }

  // Incoming media streams (audio/video tracks)
  room.onPeerStream = (stream: MediaStream, peerId: string) => {
    handlers.onStream(stream, peerId)
  }

  const addStream = (stream: MediaStream) => {
    room.addStream(stream)
  }
  const removeStream = (stream: MediaStream) => {
    room.removeStream(stream)
  }

  const leave = () => {
    try {
      void room.leave()
    } catch {
      /* ignore */
    }
  }

  // Announce ourselves to anyone already in the room.
  announceProfile()

  return {
    room,
    selfId,
    announceProfile,
    sendMessage,
    sendMedia,
    addStream,
    removeStream,
    leave,
  }
}
