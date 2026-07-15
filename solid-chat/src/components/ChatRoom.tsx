import { onCleanup, onMount, createSignal, Show, For } from 'solid-js'
import type { Profile, ChatMessage, WireMedia, PeerInfo } from '../types'
import { createChat, type ChatController } from '../lib/chat'
import { initIpfs, getNodeId, addFile, catFile } from '../lib/ipfs'
import { randomId, colorFromId, formatTime } from '../lib/utils'
import {
  peers, setPeers, messages, setMessages,
  remoteStreams, setRemoteStreams, localStream, setLocalStream,
  callState, setCallState, micEnabled, setMicEnabled, camEnabled, setCamEnabled,
  ipfsStatus, setIpfsStatus, ipfsNodeId, setIpfsNodeId,
  connected, setConnected, selfId, setSelfId,
  pushToast, resetStore,
} from '../store'
import TopBar from './TopBar'
import PeerList from './PeerList'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import CallBar from './CallBar'

export default function ChatRoom(props: { profile: Profile; onLeave: () => void }) {
  const [controller, setController] = createSignal<ChatController | null>(null)
  const [sending, setSending] = createSignal(false)
  const [sendProgress, setSendProgress] = createSignal(0)

  onMount(() => {
    const ctrl = createChat(props.profile, {
      onPeerJoin: (peer) => {
        setPeers((p) => ({ ...p, [peer.id]: peer }))
      },
      onPeerLeave: (peerId) => {
        setPeers((p) => {
          const next = { ...p }
          const name = next[peerId]?.name ?? 'Someone'
          delete next[peerId]
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
              pushToast(`${peer.name} joined`, 'success')
              setMessages((m) => [
                ...m,
                {
                  id: randomId(),
                  peerId: peer.id,
                  name: peer.name,
                  color: peer.color,
                  kind: 'system',
                  text: 'joined the room',
                  time: Date.now(),
                },
              ])
            }, 0)
          }
          return next
        })
      },
      onMessage: (msg) => {
        setMessages((m) => [...m, { ...msg, self: msg.peerId === controller()?.selfId }])
        if (msg.kind === 'file') {
          pushToast(`${msg.name} shared a file`, 'info')
        }
      },
      onMedia: (peerId, media) => {
        setPeers((p) => {
          const cur = p[peerId]
          if (!cur) return p
          return {
            ...p,
            [peerId]: { ...cur, media: media.event === 'start' ? media.kind : 'none' },
          }
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
    })

    setController(ctrl)
    setSelfId(ctrl.selfId)
    setConnected(true)

    // Initialize IPFS (Helia) in the background.
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

    // System greeting
    setMessages((m) => [
      ...m,
      {
        id: randomId(),
        peerId: 'system',
        name: 'System',
        color: '#52525b',
        kind: 'system',
        text: `You joined room ${props.profile.room}`,
        time: Date.now(),
        self: true,
      },
    ])
  })

  onCleanup(() => {
    controller()?.leave()
    endCall(true)
    resetStore()
  })

  /** Append a self message and broadcast it. */
  function emitSelfMessage(msg: ChatMessage) {
    setMessages((m) => [...m, { ...msg, self: true }])
    controller()?.sendMessage(msg)
  }

  async function handleSendText(text: string) {
    const t = text.trim()
    if (!t) return
    emitSelfMessage({
      id: randomId(),
      peerId: controller()?.selfId ?? 'me',
      name: props.profile.name,
      color: props.profile.color,
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
    setSending(true)
    setSendProgress(0)
    try {
      const cid = await addFile(file, (r) => setSendProgress(r * 0.5))
      emitSelfMessage({
        id: randomId(),
        peerId: controller()?.selfId ?? 'me',
        name: props.profile.name,
        color: props.profile.color,
        kind: 'file',
        file: { cid, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' },
        time: Date.now(),
      })
      pushToast('File published to IPFS', 'success')
    } catch (e) {
      console.error(e)
      pushToast('Failed to publish file to IPFS', 'error')
    } finally {
      setSending(false)
      setSendProgress(0)
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
      const media: WireMedia = { event: 'start', kind }
      controller()?.sendMedia(media)
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

  async function downloadFile(cid: string, name: string, size: number, onProgress: (r: number) => void) {
    const data = await catFile(cid, size, onProgress)
    const blob = new Blob([data as BlobPart])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const peerCount = () => Object.keys(peers()).length + 1

  return (
    <div class="flex h-full w-full flex-col bg-zinc-950 text-zinc-100">
      <TopBar
        room={props.profile.room}
        peerCount={peerCount()}
        ipfsStatus={ipfsStatus()}
        onLeave={() => {
          controller()?.leave()
          endCall(true)
          resetStore()
          props.onLeave()
        }}
      />

      <div class="flex min-h-0 flex-1">
        {/* Sidebar — peers */}
        <aside class="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40 md:flex">
          <PeerList selfName={props.profile.name} selfColor={props.profile.color} />
        </aside>

        {/* Main column */}
        <main class="flex min-w-0 flex-1 flex-col">
          <CallBar
            localStream={localStream()}
            remoteStreams={remoteStreams()}
            peers={peers()}
            callState={callState()}
            micEnabled={micEnabled()}
            camEnabled={camEnabled()}
            selfName={props.profile.name}
            selfColor={props.profile.color}
            onStartAudio={() => startCall('audio')}
            onStartVideo={() => startCall('video')}
            onEnd={() => endCall(false)}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
          />

          <MessageList
            messages={messages()}
            selfId={controller()?.selfId ?? ''}
            onDownload={downloadFile}
          />

          <MessageInput
            onSend={handleSendText}
            onFile={handleSendFile}
            sending={sending()}
            sendProgress={sendProgress()}
            ipfsReady={ipfsStatus() === 'ready'}
          />
        </main>
      </div>

      {/* Mobile peer strip */}
      <div class="flex items-center gap-2 overflow-x-auto border-t border-zinc-800 bg-zinc-900/60 px-3 py-2 md:hidden">
        <MobilePeer name={`${props.profile.name} (you)`} color={props.profile.color} />
        <For each={Object.values(peers())}>
          {(p) => <MobilePeer name={p.name} color={p.color} media={p.media} />}
        </For>
      </div>
    </div>
  )
}

function MobilePeer(props: { name: string; color: string; media?: string }) {
  return (
    <div class="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-800/70 px-2.5 py-1 text-xs">
      <span class="h-2 w-2 rounded-full" style={{ background: props.color }} />
      <span class="max-w-[8rem] truncate">{props.name}</span>
      <Show when={props.media && props.media !== 'none'}>
        <span class="text-emerald-400">{props.media === 'video' ? '📹' : '🎙️'}</span>
      </Show>
    </div>
  )
}
