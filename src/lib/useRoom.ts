import { onCleanup, onMount, createSignal } from 'solid-js'
import type { Profile, ChatMessage } from '../types'
import { createChat, type ChatController, loadSettings, saveSettings, DEFAULT_GATEWAY_URLS, DEFAULT_RELAY_URLS, type SavedSettings } from './chat'
import { initIpfs, getNodeId, addBytes, fetchFile, pinToNetwork } from './ipfs'
import { generateRoomKey, exportKey, importKey, encryptBytes, decryptBytes, type CryptoKeyLike } from './crypto'
import { log } from './debug'
import { randomId } from './utils'
import {
  setPeers, setMessages, setRemoteStreams, localStream, setLocalStream,
  callState, setCallState, micEnabled, setMicEnabled, camEnabled, setCamEnabled,
  ipfsStatus, setIpfsStatus, ipfsNodeId, setIpfsNodeId,
  connStatus, setConnStatus, setSelfId, setSignaling, setWaitingLong, peers,
  addTransfer, updateTransfer, addReceived, pushToast, resetStore,
  setRole, setApprovalState, pendingRequests, setPendingRequests,
} from '../store'

/**
 * useRoom — all room orchestration: Trystero chat, E2E key exchange, IPFS,
 * approval flow, calls, file send/download. Returns action handlers + state
 * accessors used by the <fybeam-room> layout.
 */
export function useRoom(profile: () => Profile, isCreator: () => boolean) {
  const [controller, setController] = createSignal<ChatController | null>(null)
  const [roomKey, setRoomKey] = createSignal<CryptoKeyLike | null>(null)

  /** Cache of encrypted file bytes keyed by CID, so we can re-send over WebRTC
   *  when a peer's gateway download fails. (CID → encrypted base64 string). */
  const fileCache = new Map<string, string>()
  /** Cache of original (pre-encryption) file bytes for instant self-download.
   *  Bypasses the entire encrypt/decrypt/WebRTC/gateway chain. */
  const originalBytesCache = new Map<string, Uint8Array>()
  /** Incoming file-chunk buffer: CID → { total, chunks: Map<index, data> }. */
  const incomingChunks = new Map<string, { total: number; chunks: Map<number, string> }>()
  /** Pending download requests (CID → callback) for the WebRTC fallback. */
  const pendingDownloads = new Map<string, (data: string) => void>()

  const leave = () => {
    controller()?.leave()
    endCall(true)
    resetStore()
  }

  onMount(() => {
    setConnStatus('connecting')
    setRole(isCreator() ? 'creator' : 'joiner')
    if (!isCreator()) setApprovalState('requesting')

    // Creator generates the E2E room key; joiner receives it after approval.
    if (isCreator()) {
      generateRoomKey().then((k) => {
        setRoomKey(k)
        log.ok('crypto', 'room key generated (creator)')
      })
    }

    const ctrl = createChat(
      profile(),
      {
        onPeerJoin: (peer) => {
          if (!isCreator()) {
            ctrl.sendJoinRequest(peer.id)
            setApprovalState('requesting')
          }
        },
        onPeerLeave: (peerId) => {
          setPeers((p) => {
            const next = { ...p }
            const name = next[peerId]?.name ?? 'A peer'
            delete next[peerId]
            if (Object.keys(next).length === 0) setConnStatus('connecting')
            setTimeout(() => pushToast(`${name === '…' ? 'A peer' : name} left`, 'info'), 0)
            return next
          })
          setRemoteStreams((s) => {
            const next = { ...s }
            delete next[peerId]
            return next
          })
        },
        onProfile: (peer) => {
          setPeers((p) => {
            const prev = p[peer.id]
            const isFirst = !prev || prev.name === '…'
            const next = { ...p, [peer.id]: { ...peer, media: prev?.media ?? 'none' } }
            if (isFirst) {
              setTimeout(() => {
                pushToast(`${peer.name} connected`, 'success')
                setMessages((m) => [...m, systemMsg(peer.id, peer.name, peer.color, 'connected')])
              }, 0)
            }
            return next
          })
        },
        onMessage: (msg) => {
          // Settings messages are local-only — never apply settings from peers.
          if (msg.kind === 'settings') return
          setMessages((m) => [...m, { ...msg, self: msg.peerId === controller()?.selfId }])
          if (msg.kind === 'file' && msg.file && !msg.self) {
            pushToast(`${msg.name} sent a file`, 'info')
            addReceived({
              id: randomId(),
              cid: msg.file.cid,
              name: msg.file.name,
              size: msg.file.size,
              mime: msg.file.mime,
              from: msg.name,
              time: Date.now(),
            })
          }
        },
        onMedia: (peerId, media) => {
          setPeers((p) => {
            const cur = p[peerId]
            if (!cur) return p
            return { ...p, [peerId]: { ...cur, media: media.event === 'start' ? media.kind : 'none' } }
          })
          if (media.event === 'end') {
            setRemoteStreams((s) => {
              const next = { ...s }
              delete next[peerId]
              return next
            })
          }
        },
        onStream: (stream, peerId) => {
          setRemoteStreams((s) => {
            const cur = s[peerId]
            const next = new MediaStream()
            if (cur) cur.getTracks().forEach((t) => next.addTrack(t))
            stream.getTracks().forEach((t) => {
              if (!next.getTracks().includes(t)) next.addTrack(t)
            })
            return { ...s, [peerId]: next }
          })
        },
        onPeerHandshake: () => {
          setConnStatus('handshaking')
          pushToast('Peer found, connecting…', 'info')
        },
        onJoinError: () => {
          pushToast('Connection failed — see debug console', 'error')
          if (Object.keys(peers()).length === 0) setConnStatus('connecting')
        },
        onJoinRequest: (peerId, prof) => {
          setPendingRequests((reqs) => {
            if (reqs.some((r) => r.peerId === peerId)) return reqs
            return [...reqs, { peerId, name: prof.name, color: prof.color, time: Date.now() }]
          })
          pushToast(`${prof.name} is requesting to join`, 'info')
        },
        onApproval: (_peerId, approved) => {
          if (approved) {
            setApprovalState('approved')
            setConnStatus('connected')
            pushToast('Approved — you joined the room', 'success')
          } else {
            setApprovalState('denied')
            pushToast('Your join request was denied', 'error')
            setTimeout(() => leave(), 1800)
          }
        },
        onRoomKey: (_peerId, keyB64) => {
          importKey(keyB64)
            .then((k) => {
              setRoomKey(k)
              log.ok('crypto', 'room key imported (joiner)')
              pushToast('E2E encryption enabled', 'success')
            })
            .catch((e) => log.error('crypto', 'failed to import room key', e))
        },
        onFileChunk: (peerId, chunk) => {
          // Receiving a chunk of encrypted file bytes over WebRTC.
          let buf = incomingChunks.get(chunk.cid)
          if (!buf) {
            buf = { total: chunk.total, chunks: new Map() }
            incomingChunks.set(chunk.cid, buf)
          }
          buf.chunks.set(chunk.index, chunk.data)
          log.info('file', 'chunk received', { cid: chunk.cid.slice(0, 8), index: chunk.index, total: chunk.total, have: buf.chunks.size })
          if (buf.chunks.size === buf.total) {
            // All chunks arrived — assemble.
            let assembled = ''
            for (let i = 0; i < buf.total; i++) assembled += buf.chunks.get(i) ?? ''
            incomingChunks.delete(chunk.cid)
            const cb = pendingDownloads.get(chunk.cid)
            if (cb) {
              pendingDownloads.delete(chunk.cid)
              cb(assembled)
            }
          }
        },
        onFileRequest: async (peerId, cid) => {
          // A peer is requesting file bytes — send from cache via WebRTC.
          const encB64 = fileCache.get(cid)
          if (!encB64) {
            log.warn('file', 'request for unknown CID (not in cache)', { cid: cid.slice(0, 8) })
            return
          }
          log.info('file', 'responding to file request via WebRTC', { to: peerId, cid: cid.slice(0, 8) })
          // Chunk size: ~12KB per chunk (base64). Trystero data channel limit.
          const CHUNK_SIZE = 12000
          // Send in small batches with a yield between batches so we don't
          // flood the WebRTC SCTP send buffer. Without flow control the
          // browser drops/delays chunks, the 10s timeout fires, and the
          // download falls back to slow IPFS gateways.
          const BATCH_SIZE = 20
          const total = Math.ceil(encB64.length / CHUNK_SIZE)
          for (let i = 0; i < total; i += BATCH_SIZE) {
            const batchEnd = Math.min(i + BATCH_SIZE, total)
            const batch: Promise<void>[] = []
            for (let j = i; j < batchEnd; j++) {
              const data = encB64.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE)
              batch.push(ctrl.sendFileChunk(peerId, { cid, index: j, total, data }))
            }
            await Promise.all(batch)
            // Yield to the event loop so the browser can drain the SCTP
            // send buffer before we enqueue the next batch.
            await new Promise((r) => setTimeout(r, 0))
          }
        },
      },
      () => roomKey(),
    )

    setController(ctrl)
    setSelfId(ctrl.selfId)

    // IPFS (Helia) init in the background.
    setIpfsStatus('init')
    initIpfs()
      .then(async () => {
        setIpfsStatus('ready')
        const id = await getNodeId()
        setIpfsNodeId(id)
      })
      .catch((e) => {
        console.error('IPFS init failed', e)
        setIpfsStatus('error')
      })

    setMessages((m) => [...m, systemMsg('system', 'System', '#a1a1aa', `You joined room ${profile().room}`, true)])

    // Poll signaling relay count.
    const sigTimer = setInterval(() => setSignaling(ctrl.getSignalingInfo()), 2000)
    setSignaling(ctrl.getSignalingInfo())
    const waitTimer = setTimeout(() => {
      if (Object.keys(peers()).length === 0) setWaitingLong(true)
    }, 18000)

    onCleanup(() => {
      clearInterval(sigTimer)
      clearTimeout(waitTimer)
    })
  })

  onCleanup(() => {
    controller()?.leave()
    endCall(true)
    resetStore()
  })

  function emitSelfMessage(msg: ChatMessage) {
    setMessages((m) => [...m, { ...msg, self: true }])
    controller()?.sendMessage(msg)
  }

  function handleSendText(text: string) {
    const t = text.trim()
    if (!t) return
    emitSelfMessage({
      id: randomId(),
      peerId: controller()?.selfId ?? 'me',
      name: profile().name,
      color: profile().color,
      kind: 'text',
      text: t,
      time: Date.now(),
    })
  }

  async function handleSendFile(file: File) {
    if (ipfsStatus() !== 'ready') {
      pushToast('IPFS is still starting up, try again in a moment', 'error')
      return
    }
    const tid = randomId()
    addTransfer({ id: tid, name: file.name, size: file.size, dir: 'send', peerName: 'all', progress: 0, done: false, time: Date.now() })
    try {
      const rawBytes = new Uint8Array(await file.arrayBuffer())
      let bytesToUpload: Uint8Array = rawBytes
      let encB64: string | null = null
      const key = roomKey()
      if (key) {
        encB64 = await encryptBytes(key, rawBytes)
        bytesToUpload = new TextEncoder().encode(encB64)
        log.info('crypto', 'file encrypted before IPFS upload', { original: rawBytes.byteLength, encrypted: bytesToUpload.byteLength })
      }
      const cid = await addBytes(bytesToUpload, (r) => updateTransfer(tid, { progress: r * 0.7 }), orderedGateways())
      // Cache for WebRTC re-send (encrypted bytes only) and instant
      // self-download (original bytes, regardless of encryption).
      if (encB64) fileCache.set(cid, encB64)
      originalBytesCache.set(cid, rawBytes)
      emitSelfMessage({
        id: randomId(),
        peerId: controller()?.selfId ?? 'me',
        name: profile().name,
        color: profile().color,
        kind: 'file',
        file: { cid, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' },
        time: Date.now(),
      })
      updateTransfer(tid, { progress: 1, done: true })
      pushToast('File published to IPFS', 'success')
    } catch (e) {
      console.error(e)
      updateTransfer(tid, { done: true })
      pushToast('Failed to publish file to IPFS', 'error')
    }
  }

  async function startCall(kind: 'audio' | 'video') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
      })
      setLocalStream(stream)
      setCallState(kind)
      setMicEnabled(true)
      setCamEnabled(true)
      controller()?.addStream(stream)
      controller()?.sendMedia({ event: 'start', kind })
      pushToast(`${kind === 'video' ? 'Video' : 'Audio'} call started`, 'success')
    } catch (e) {
      console.error(e)
      pushToast('Could not access camera/microphone', 'error')
    }
  }

  function endCall(silent = false) {
    const stream = localStream()
    if (stream) {
      controller()?.removeStream(stream)
      stream.getTracks().forEach((t) => t.stop())
    }
    setLocalStream(null)
    if (callState() !== 'idle') {
      controller()?.sendMedia({ event: 'end', kind: callState() === 'video' ? 'video' : 'audio' })
    }
    setCallState('idle')
    setMicEnabled(true)
    setCamEnabled(true)
    if (!silent) pushToast('Call ended', 'info')
  }

  function toggleMic() {
    const stream = localStream()
    if (!stream) return
    const next = !micEnabled()
    stream.getAudioTracks().forEach((t) => (t.enabled = next))
    setMicEnabled(next)
  }

  function toggleCam() {
    const stream = localStream()
    if (!stream) return
    const next = !camEnabled()
    stream.getVideoTracks().forEach((t) => (t.enabled = next))
    setCamEnabled(next)
  }

  async function handleDownload(cid: string, name: string, size: number, from: string) {
    const tid = randomId()
    addTransfer({ id: tid, name, size, dir: 'recv', peerName: from, progress: 0, done: false, time: Date.now() })

    try {
      let encB64: string | null = null

      // 0) Self-download shortcut: if we have the original bytes cached (we
      //    just sent this file), build the Blob directly — no decrypt, no
      //    WebRTC, no gateways, no network at all.
      const origBytes = originalBytesCache.get(cid)
      if (origBytes) {
        log.info('file', 'found in original bytes cache — downloading instantly', { cid: cid.slice(0, 8) })
        updateTransfer(tid, { progress: 0.9 })
        const blob = new Blob([origBytes])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
        updateTransfer(tid, { progress: 1, done: true })
        pushToast(`Saved ${name}`, 'success')
        return
      }

      // 1) Try WebRTC first (instant if the sender is online — avoids the
      //    30-60s delay of public IPFS gateways timing out on browser-only CIDs).
      const peerIds = Object.keys(peers())
      if (peerIds.length > 0) {
        log.info('file', 'requesting via WebRTC', { cid: cid.slice(0, 8), size })
        encB64 = await new Promise<string | null>((resolve) => {
          // Adaptive timeout: 10s base + 2s per MB of file size, max 60s.
          // Small files get a quick timeout; large files get enough time for
          // the batched flow control to complete the transfer.
          const timeoutMs = Math.min(10000 + Math.floor(size / (1024 * 1024)) * 2000, 60000)
          const timeout = setTimeout(() => {
            pendingDownloads.delete(cid)
            resolve(null) // WebRTC timed out — fall through to gateway.
          }, timeoutMs)
          pendingDownloads.set(cid, (data) => {
            clearTimeout(timeout)
            pendingDownloads.delete(cid)
            resolve(data)
          })
          // Request from the first connected peer.
          controller()?.sendFileRequest(peerIds[0], cid)
        })
        if (encB64) {
          log.ok('file', 'received via WebRTC', { cid: cid.slice(0, 8), bytes: encB64.length })
          updateTransfer(tid, { progress: 0.9 })
        }
      }

      // 2) Fallback: public IPFS gateways (with a 15s timeout per gateway).
      if (!encB64) {
        log.info('file', 'WebRTC failed/unavailable, trying IPFS gateways', { cid: cid.slice(0, 8) })
        const data = await fetchFile(cid, size, (r) => updateTransfer(tid, { progress: r * 0.8 }), orderedGateways())
        encB64 = new TextDecoder().decode(data)
      }

      // 3) Decrypt + save.
      let fileBytes: Uint8Array
      const key = roomKey()
      if (key && encB64) {
        fileBytes = await decryptBytes(key, encB64)
        log.info('crypto', 'file decrypted', { encrypted: encB64.length, decrypted: fileBytes.byteLength })
      } else {
        fileBytes = new TextEncoder().encode(encB64 ?? '')
      }
      const blob = new Blob([fileBytes as BlobPart])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      updateTransfer(tid, { progress: 1, done: true })
      pushToast(`Saved ${name}`, 'success')
    } catch (e) {
      console.error(e)
      updateTransfer(tid, { done: true })
      pushToast('Could not fetch/decrypt file', 'error')
    }
  }

  async function handlePin(cid: string, name: string) {
    pushToast(`Pinning ${name} to IPFS network…`, 'info')
    try {
      let bytes: Uint8Array | null = null

      // 0a) fileCache — has encrypted bytes as base64 (exact IPFS content).
      const encB64 = fileCache.get(cid)
      if (encB64) {
        bytes = new TextEncoder().encode(encB64)
      }

      // 0b) originalBytesCache — has raw file bytes (joiner, unencrypted).
      if (!bytes) {
        const origBytes = originalBytesCache.get(cid)
        if (origBytes) bytes = origBytes
      }

      // 1) Try WebRTC from a connected peer.
      if (!bytes) {
        const peerIds = Object.keys(peers())
        if (peerIds.length > 0) {
          log.info('file', 'requesting file for pin via WebRTC', { cid: cid.slice(0, 8) })
          const b64 = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => { pendingDownloads.delete(cid); resolve(null) }, 10000)
            pendingDownloads.set(cid, (data) => { clearTimeout(timeout); pendingDownloads.delete(cid); resolve(data) })
            controller()?.sendFileRequest(peerIds[0], cid)
          })
          if (b64) bytes = new TextEncoder().encode(b64)
        }
      }

      // 2) Fallback: fetch from local Helia or gateways.
      if (!bytes) {
        bytes = await fetchFile(cid, 0, undefined, orderedGateways())
      }

      if (!bytes) throw new Error('could not obtain file bytes')

      const ok = await pinToNetwork(cid, bytes, undefined, orderedGateways())
      if (ok) {
        pushToast(`${name} pinned to IPFS`, 'success')
      } else {
        pushToast(`Could not pin ${name}`, 'error')
        throw new Error('pin failed')
      }
    } catch (e) {
      console.error(e)
      pushToast(`Failed to pin ${name}`, 'error')
      throw e
    }
  }

  async function approveJoiner(peerId: string) {
    const req = pendingRequests().find((r) => r.peerId === peerId)
    if (!req) return
    controller()?.sendApproval(peerId, true)
    const key = roomKey()
    if (key) {
      try {
        const keyB64 = await exportKey(key)
        controller()?.sendRoomKey(peerId, keyB64)
      } catch (e) {
        log.error('crypto', 'failed to export room key', e)
      }
    }
    setPeers((p) => ({
      ...p,
      [peerId]: { id: peerId, name: req.name, color: req.color, joinedAt: Date.now(), media: 'none' },
    }))
    setPendingRequests((reqs) => reqs.filter((r) => r.peerId !== peerId))
    setConnStatus('connected')
    pushToast(`Approved ${req.name}`, 'success')
    setMessages((m) => [...m, systemMsg(peerId, req.name, req.color, 'joined the room')])
  }

  function denyJoiner(peerId: string) {
    const req = pendingRequests().find((r) => r.peerId === peerId)
    controller()?.sendApproval(peerId, false)
    controller()?.removePeer(peerId)
    setPendingRequests((reqs) => reqs.filter((r) => r.peerId !== peerId))
    pushToast(`Denied ${req?.name ?? 'joiner'}`, 'info')
  }

  function handleSendSettings(gateways: string[], relays: string[], firstGateway: string, firstRelay: string, inPlace = false) {
    saveSettings(gateways, relays, firstGateway, firstRelay)
    const json = JSON.stringify({ gateways, relays, firstGateway, firstRelay })
    if (inPlace) {
      setMessages((m) => {
        const last = [...m].reverse().find(msg => msg.kind === 'settings' && msg.self)
        if (last) {
          return m.map(msg => msg.id === last.id ? { ...msg, text: json, time: Date.now() } : msg)
        }
        return [...m, {
          id: randomId(),
          peerId: controller()?.selfId ?? 'me',
          name: profile().name,
          color: profile().color,
          kind: 'settings',
          text: json,
          time: Date.now(),
          self: true,
        }]
      })
    } else {
      const msg: ChatMessage = {
        id: randomId(),
        peerId: controller()?.selfId ?? 'me',
        name: profile().name,
        color: profile().color,
        kind: 'settings',
        text: json,
        time: Date.now(),
        self: true,
      }
      setMessages((m) => [...m, msg])
    }
    pushToast('Settings saved', 'success')
  }

  return {
    controller,
    leave,
    handleSendText,
    handleSendFile,
    handleDownload,
    handlePin,
    handleSendSettings,
    startCall,
    endCall,
    toggleMic,
    toggleCam,
    approveJoiner,
    denyJoiner,
  }
}

/** Build an ordered gateway list from user settings: firstGateway first, then
 *  the rest in configured order. Falls back to DEFAULT_GATEWAY_URLS. */
function orderedGateways(): string[] {
  const settings = loadSettings()
  const gws = settings.gateways?.length ? settings.gateways : DEFAULT_GATEWAY_URLS
  const first = settings.firstGateway || gws[0]
  if (first && gws.length > 1 && gws[0] !== first) {
    return [first, ...gws.filter((g) => g !== first)]
  }
  return gws
}

function systemMsg(peerId: string, name: string, color: string, text: string, self = false): ChatMessage {
  return { id: randomId(), peerId, name, color, kind: 'text', text, time: Date.now(), self }
}
