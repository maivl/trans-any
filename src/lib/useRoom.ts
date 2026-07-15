import { onCleanup, onMount, createSignal } from 'solid-js'
import type { Profile, ChatMessage } from '../types'
import { createChat, type ChatController } from './chat'
import { initIpfs, getNodeId, addBytes, fetchFile } from './ipfs'
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
      const key = roomKey()
      if (key) {
        const encB64 = await encryptBytes(key, rawBytes)
        bytesToUpload = new TextEncoder().encode(encB64)
        log.info('crypto', 'file encrypted before IPFS upload', { original: rawBytes.byteLength, encrypted: bytesToUpload.byteLength })
      }
      const cid = await addBytes(bytesToUpload, (r) => updateTransfer(tid, { progress: r * 0.7 }))
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
      const data = await fetchFile(cid, size, (r) => updateTransfer(tid, { progress: r * 0.8 }))
      let fileBytes: Uint8Array = data
      const key = roomKey()
      if (key) {
        const encB64 = new TextDecoder().decode(data)
        fileBytes = await decryptBytes(key, encB64)
        log.info('crypto', 'file decrypted after IPFS download', { encrypted: data.byteLength, decrypted: fileBytes.byteLength })
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

  return {
    controller,
    leave,
    handleSendText,
    handleSendFile,
    handleDownload,
    startCall,
    endCall,
    toggleMic,
    toggleCam,
    approveJoiner,
    denyJoiner,
  }
}

function systemMsg(peerId: string, name: string, color: string, text: string, self = false): ChatMessage {
  return { id: randomId(), peerId, name, color, kind: 'system', text, time: Date.now(), self }
}
