import { onCleanup, onMount, createSignal, Show } from 'solid-js'
import type { Profile, ChatMessage } from '../types'
import { createChat, type ChatController } from '../lib/chat'
import { initIpfs, getNodeId, addFile, catFile } from '../lib/ipfs'
import { randomId } from '../lib/utils'
import {
  setPeers, setMessages,
  setRemoteStreams, localStream, setLocalStream,
  callState, setCallState, micEnabled, setMicEnabled, camEnabled, setCamEnabled,
  ipfsStatus, setIpfsStatus, ipfsNodeId, setIpfsNodeId,
  connStatus, setConnStatus, setSelfId,
  setSignaling, setWaitingLong, peers,
  tab, setTab, addTransfer, updateTransfer, addReceived,
  pushToast, resetStore,
} from '../store'
import Sidebar from './Sidebar'
import FilesView from './FilesView'
import ChatView from './ChatView'

export default function RoomShell(props: { profile: Profile; onLeave: () => void }) {
  const [controller, setController] = createSignal<ChatController | null>(null)

  onMount(() => {
    setConnStatus('connecting')
    const ctrl = createChat(props.profile, {
      onPeerJoin: (peer) => {
        setPeers((p) => ({ ...p, [peer.id]: peer }))
        setConnStatus('connected')
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
              setMessages((m) => [
                ...m,
                {
                  id: randomId(),
                  peerId: peer.id,
                  name: peer.name,
                  color: peer.color,
                  kind: 'system',
                  text: 'connected',
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

    setMessages((m) => [
      ...m,
      {
        id: randomId(),
        peerId: 'system',
        name: 'System',
        color: '#a1a1aa',
        kind: 'system',
        text: `You joined room ${props.profile.room}`,
        time: Date.now(),
        self: true,
      },
    ])

    // Poll signaling-relay connection count for the sidebar indicator.
    const sigTimer = setInterval(() => {
      const info = ctrl.getSignalingInfo()
      setSignaling(info)
    }, 2000)
    setSignaling(ctrl.getSignalingInfo())

    // After ~18s with no peer, surface a "still waiting" hint.
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
    const tid = randomId()
    addTransfer({
      id: tid,
      name: file.name,
      size: file.size,
      dir: 'send',
      peerName: 'all',
      progress: 0,
      done: false,
      time: Date.now(),
    })
    try {
      const cid = await addFile(file, (r) => updateTransfer(tid, { progress: r * 0.7 }))
      emitSelfMessage({
        id: randomId(),
        peerId: controller()?.selfId ?? 'me',
        name: props.profile.name,
        color: props.profile.color,
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
      setTab('chat')
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

  // download with a transfer entry in the sidebar
  async function handleDownload(cid: string, name: string, size: number, from: string) {
    const tid = randomId()
    addTransfer({
      id: tid,
      name,
      size,
      dir: 'recv',
      peerName: from,
      progress: 0,
      done: false,
      time: Date.now(),
    })
    try {
      await downloadFile(cid, name, size, (r) => updateTransfer(tid, { progress: r }))
      updateTransfer(tid, { progress: 1, done: true })
      pushToast(`Saved ${name}`, 'success')
    } catch (e) {
      console.error(e)
      updateTransfer(tid, { done: true })
      pushToast('Could not fetch from IPFS', 'error')
    }
  }

  const leave = () => {
    controller()?.leave()
    endCall(true)
    resetStore()
    props.onLeave()
  }

  return (
    <div class="flex h-full w-full bg-zinc-50 text-zinc-900">
      {/* Desktop sidebar */}
      <div class="hidden md:flex">
        <Sidebar profile={props.profile} onLeave={leave} />
      </div>

      <main class="flex min-w-0 flex-1 flex-col">
        {/* Mobile top header */}
        <header class="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <div class="flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
                <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="leading-tight">
              <div class="text-sm font-semibold">{props.profile.roomName}</div>
              <div class="font-mono text-[10px] text-zinc-400">room / {props.profile.room}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <ConnDot />
            <button
              type="button"
              onClick={leave}
              class="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Leave
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col">
          <Show when={tab() === 'files'}>
            <FilesView onSendFile={handleSendFile} onDownload={handleDownload} />
          </Show>
          <Show when={tab() === 'chat'}>
            <ChatView
              profile={props.profile}
              onStartAudio={() => startCall('audio')}
              onStartVideo={() => startCall('video')}
              onEndCall={() => endCall(false)}
              onToggleMic={toggleMic}
              onToggleCam={toggleCam}
              onSendText={handleSendText}
              onDownload={handleDownload}
            />
          </Show>
        </div>

        {/* Mobile bottom tab bar */}
        <nav class="flex gap-1.5 border-t border-zinc-200 bg-white p-3 md:hidden">
          <MobileTab active={tab() === 'files'} onClick={() => setTab('files')} icon="files">Files</MobileTab>
          <MobileTab active={tab() === 'chat'} onClick={() => setTab('chat')} icon="chat">Chat</MobileTab>
        </nav>
      </main>
    </div>
  )
}

function ConnDot() {
  const info = () => {
    const s = connStatus()
    if (s === 'connected') return { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-600' }
    if (s === 'connecting') return { label: 'Waiting', dot: 'bg-amber-500', text: 'text-amber-600' }
    return { label: 'Offline', dot: 'bg-rose-500', text: 'text-rose-600' }
  }
  return (
    <span class={`flex items-center gap-1 text-[11px] font-medium ${info().text}`}>
      <span class={`h-1.5 w-1.5 rounded-full ${info().dot}`} />
      {info().label}
    </span>
  )
}

function MobileTab(props: { active: boolean; onClick: () => void; icon: string; children: any }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition"
      classList={{
        'bg-zinc-900 text-white': props.active,
        'bg-zinc-100 text-zinc-500': !props.active,
      }}
    >
      <Show when={props.icon === 'files'}>
        <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </Show>
      <Show when={props.icon === 'chat'}>
        <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </Show>
      {props.children}
    </button>
  )
}
