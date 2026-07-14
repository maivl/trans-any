import { onCleanup, onMount, createSignal, Show, For, createEffect } from 'solid-js'
import { customElement, getCurrentElement, noShadowDOM } from 'solid-element'
import type { Profile, ChatMessage } from '../types'
import { createChat, type ChatController } from '../lib/chat'
import { initIpfs, getNodeId, addFile, catFile } from '../lib/ipfs'
import { buildShareUrl, renderQrToCanvas, renderQrDataUrl } from '../lib/qr'
import { randomId, formatTime, formatBytes, shortCid, gatewayUrl, fileEmoji } from '../lib/utils'
import { subscribeDebug, clearDebugLog, type DebugEntry } from '../lib/debug'
import {
  setPeers, setMessages,
  setRemoteStreams, localStream, setLocalStream,
  callState, setCallState, micEnabled, setMicEnabled, camEnabled, setCamEnabled,
  ipfsStatus, setIpfsStatus, ipfsNodeId, setIpfsNodeId,
  connStatus, setConnStatus, setSelfId,
  setSignaling, setWaitingLong, peers,
  tab, setTab, addTransfer, updateTransfer, addReceived,
  pushToast, resetStore,
  signaling, waitingLong, messages, remoteStreams, transfers, received,
  toasts,
} from '../store'

/**
 * <fybeam-room>
 * The whole chat experience as a single Web Component (Solid customElement).
 * The host page just drops this element in; the component auto-joins a room
 * based on the `room` / `name` props (filled by index.ts from ?room= or random).
 */
function FybeamRoom(props: { room: string; name: string; color: string; roomName: string }) {
  // Render in light DOM (no shadow root) so the document's Tailwind styles
  // apply to the component's content.
  noShadowDOM()
  const profile = (): Profile => ({
    name: props.name,
    color: props.color,
    room: props.room,
    roomName: props.roomName,
  })

  const [controller, setController] = createSignal<ChatController | null>(null)
  const [debugEntries, setDebugEntries] = createSignal<DebugEntry[]>([])
  const [showDebug, setShowDebug] = createSignal(false)
  const [copiedLink, setCopiedLink] = createSignal(false)
  let qrCanvas: HTMLCanvasElement | undefined

  onMount(() => {
    setConnStatus('connecting')
    const ctrl = createChat(profile(), {
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
      onPeerHandshake: (peerId) => {
        // Signaling found a peer; WebRTC handshake starting (not connected yet).
        setConnStatus('handshaking')
        pushToast('Peer found, connecting…', 'info')
      },
      onJoinError: (details) => {
        pushToast('Connection failed — see debug console', 'error')
        // If no fully-connected peer remains, go back to waiting.
        if (Object.keys(peers()).length === 0) setConnStatus('connecting')
      },
    })

    setController(ctrl)
    setSelfId(ctrl.selfId)

    // Subscribe debug buffer for the debug panel.
    const unsub = subscribeDebug((entries) => setDebugEntries(entries.slice(-200)))

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
        text: `You joined room ${props.room}`,
        time: Date.now(),
        self: true,
      },
    ])

    // Poll signaling + peer ICE states.
    const sigTimer = setInterval(() => {
      setSignaling(ctrl.getSignalingInfo())
    }, 2000)
    setSignaling(ctrl.getSignalingInfo())

    const waitTimer = setTimeout(() => {
      if (Object.keys(peers()).length === 0) setWaitingLong(true)
    }, 18000)

    onCleanup(() => {
      clearInterval(sigTimer)
      clearTimeout(waitTimer)
      unsub()
    })
  })

  onCleanup(() => {
    controller()?.leave()
    endCall(true)
    resetStore()
  })

  // Render QR to the inline canvas.
  const shareUrl = () => buildShareUrl(props.room)
  createEffect(() => {
    const c = qrCanvas
    if (c) renderQrToCanvas(c, shareUrl(), 112).catch((e) => console.error('QR render failed', e))
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
      name: props.name,
      color: props.color,
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
      const cid = await addFile(file, (r) => updateTransfer(tid, { progress: r * 0.7 }))
      emitSelfMessage({
        id: randomId(),
        peerId: controller()?.selfId ?? 'me',
        name: props.name,
        color: props.color,
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

  async function handleDownload(cid: string, name: string, size: number, from: string) {
    const tid = randomId()
    addTransfer({ id: tid, name, size, dir: 'recv', peerName: from, progress: 0, done: false, time: Date.now() })
    try {
      const data = await catFile(cid, size, (r) => updateTransfer(tid, { progress: r }))
      const blob = new Blob([data as BlobPart])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      updateTransfer(tid, { progress: 1, done: true })
      pushToast(`Saved ${name}`, 'success')
    } catch (e) {
      console.error(e)
      updateTransfer(tid, { done: true })
      pushToast('Could not fetch from IPFS', 'error')
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 1500)
    } catch {
      pushToast('Could not copy link', 'error')
    }
  }
  const downloadQr = async () => {
    try {
      const dataUrl = await renderQrDataUrl(shareUrl(), 480)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `fybeam-room-${props.room}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      pushToast('Could not save QR', 'error')
    }
  }

  const leave = () => {
    controller()?.leave()
    endCall(true)
    resetStore()
    // Notify the host page via a CustomEvent.
    try {
      const host = (typeof getCurrentElement === 'function' ? getCurrentElement() : null) as HTMLElement | null
      host?.dispatchEvent(new CustomEvent('leave', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }

  const peerList = () => Object.values(peers())
  const statusInfo = () => {
    const s = connStatus()
    if (s === 'connected') return { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-600' }
    if (s === 'handshaking') return { label: 'Connecting…', dot: 'bg-sky-500', text: 'text-sky-600' }
    if (s === 'connecting') return { label: 'Waiting', dot: 'bg-amber-500', text: 'text-amber-600' }
    return { label: 'Disconnected', dot: 'bg-rose-500', text: 'text-rose-600' }
  }
  const ipfsLabel = () =>
    ipfsStatus() === 'ready' ? 'IPFS ready' : ipfsStatus() === 'init' ? 'IPFS starting…' : 'IPFS error'
  const peerStates = () => {
    try {
      return controller()?.getPeerStates() ?? {}
    } catch {
      return {}
    }
  }

  return (
    <div class="flex h-full w-full bg-zinc-50 text-zinc-900">
      {/* Desktop sidebar */}
      <aside class="hidden h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex md:w-72">
        <SidebarContent
          room={props.room} roomName={props.roomName} name={props.name} color={props.color}
          qrCanvas={(el: HTMLCanvasElement | undefined) => (qrCanvas = el)}
          copiedLink={copiedLink()} onCopyLink={copyLink} onDownloadQr={downloadQr}
          statusInfo={statusInfo()} signaling={signaling()} waitingLong={waitingLong()} connStatus={connStatus()}
          peerList={peerList()} peerStates={peerStates()} ipfsLabel={ipfsLabel()} ipfsStatus={ipfsStatus()}
          transfers={transfers()} received={received().filter((f) => f.cid)}
          tab={tab()} setTab={setTab} onLeave={leave}
          showDebug={showDebug()} setShowDebug={setShowDebug}
          debugEntries={debugEntries()} onClearDebug={() => clearDebugLog()}
        />
      </aside>

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
              <div class="text-sm font-semibold">{props.roomName}</div>
              <div class="font-mono text-[10px] text-zinc-400">room / {props.room}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class={`flex items-center gap-1 text-[11px] font-medium ${statusInfo().text}`}>
              <span class={`h-1.5 w-1.5 rounded-full ${statusInfo().dot}`} />
              {statusInfo().label}
            </span>
            <button type="button" onClick={leave} class="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
              Leave
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col">
          <Show when={tab() === 'files'}>
            <FilesPane onSendFile={handleSendFile} ipfsReady={ipfsStatus() === 'ready'} received={received().filter((f) => f.cid)} onDownload={handleDownload} />
          </Show>
          <Show when={tab() === 'chat'}>
            <ChatPane
              name={props.name} color={props.color}
              messages={messages()} localStream={localStream()} remoteStreams={remoteStreams()} peers={peers()}
              callState={callState()} micEnabled={micEnabled()} camEnabled={camEnabled()}
              onStartAudio={() => startCall('audio')} onStartVideo={() => startCall('video')}
              onEndCall={() => endCall(false)} onToggleMic={toggleMic} onToggleCam={toggleCam}
              onSendText={handleSendText} onDownload={handleDownload}
              setShowDebug={setShowDebug} showDebug={showDebug()}
              debugEntries={debugEntries()} onClearDebug={() => clearDebugLog()}
            />
          </Show>
        </div>

        {/* Mobile bottom tab bar */}
        <nav class="flex gap-1.5 border-t border-zinc-200 bg-white p-3 md:hidden">
          <button type="button" onClick={() => setTab('files')} class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium" classList={{ 'bg-zinc-900 text-white': tab() === 'files', 'bg-zinc-100 text-zinc-500': tab() !== 'files' }}>
            <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Files
          </button>
          <button type="button" onClick={() => setTab('chat')} class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium" classList={{ 'bg-zinc-900 text-white': tab() === 'chat', 'bg-zinc-100 text-zinc-500': tab() !== 'chat' }}>
            <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Chat
          </button>
        </nav>
      </main>

      {/* Toasts */}
      <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <For each={toasts()}>
          {(t) => (
            <div
              class="animate-fade-in-up pointer-events-auto flex items-center gap-2 rounded-lg border bg-white px-3.5 py-2.5 text-sm shadow-lg"
              classList={{
                'border-emerald-200 text-emerald-700': t.kind === 'success',
                'border-rose-200 text-rose-700': t.kind === 'error',
                'border-zinc-200 text-zinc-700': t.kind === 'info',
              }}
            >
              <Show when={t.kind === 'success'}>✓</Show>
              <Show when={t.kind === 'error'}>⚠</Show>
              <span>{t.text}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

/* ---- Sidebar content (used inside the <aside>) ---- */
function SidebarContent(props: {
  room: string; roomName: string; name: string; color: string
  qrCanvas: (el: HTMLCanvasElement | undefined) => void
  copiedLink: boolean; onCopyLink: () => void; onDownloadQr: () => void
  statusInfo: { label: string; dot: string; text: string }
  signaling: { open: number; total: number }
  waitingLong: boolean; connStatus: string
  peerList: { id: string; name: string; color: string; media?: string }[]
  peerStates: Record<string, { ice: string; conn: string }>
  ipfsLabel: string; ipfsStatus: string
  transfers: { id: string; name: string; size: number; dir: string; progress: number; done: boolean; time: number }[]
  received: { id: string; cid: string; name: string; size: number; mime: string; from: string; time: number }[]
  tab: string; setTab: (t: 'files' | 'chat') => void; onLeave: () => void
  showDebug: boolean; setShowDebug: (v: boolean) => void
  debugEntries: DebugEntry[]; onClearDebug: () => void
}) {
  return (
    <>
      <div class="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4">
            <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="text-base font-semibold tracking-tight">fybeam</span>
      </div>

      <div class="px-5 pb-3">
        <div class="truncate text-sm font-semibold text-zinc-900">{props.roomName}</div>
        <div class="font-mono text-xs text-zinc-400">room / {props.room}</div>
        <div class={`mt-2 flex items-center gap-1.5 text-xs font-medium ${props.statusInfo.text}`}>
          <span class={`h-1.5 w-1.5 rounded-full ${props.statusInfo.dot}`} />
          {props.statusInfo.label}
        </div>
        <div class="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span class="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Signaling {props.signaling.open}/{props.signaling.total} relays
        </div>
        <Show when={props.waitingLong && props.connStatus === 'connecting'}>
          <div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700">
            No peer found yet. Both sides must be on this page at the same time
            with the same room code ({props.room}). If the Debug console shows
            "handshake: peer discovered" but never "presence: peer join", the
            WebRTC connection (ICE) is failing — usually a NAT/firewall blocking
            direct P2P (no free public TURN is available).
          </div>
        </Show>
        <Show when={props.connStatus === 'handshaking'}>
          <div class="mt-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] leading-relaxed text-sky-700">
            Peer found via signaling — establishing WebRTC connection…
            (If this stays for >20s, ICE is failing; check the Debug console.)
          </div>
        </Show>
      </div>

      {/* Inline QR */}
      <div class="border-y border-zinc-100 bg-zinc-50/60 px-5 py-3">
        <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Share room</div>
        <div class="flex justify-center">
          <div class="rounded-lg border border-zinc-200 bg-white p-1.5 shadow-sm">
            <canvas ref={props.qrCanvas} class="block h-28 w-28" aria-label="QR code for room share link" />
          </div>
        </div>
        <p class="mt-1.5 text-center text-[10px] leading-relaxed text-zinc-400">Scan to open with this room code</p>
        <div class="mt-2 flex gap-1.5">
          <button type="button" onClick={props.onCopyLink} class="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50">
            {props.copiedLink ? '✓ Copied' : '⧉ Copy link'}
          </button>
          <button type="button" onClick={props.onDownloadQr} class="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50">
            ⬇ Save QR
          </button>
        </div>
      </div>

      {/* Scrollable middle */}
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {/* DEVICES */}
        <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Devices</div>
        <div class="mt-1.5 mb-4">
          <div class="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: props.color }}>
              {props.name.slice(0, 2).toUpperCase()}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-800">
                {props.name}
                <span class="rounded bg-zinc-900 px-1 py-0.5 text-[9px] font-semibold text-white">YOU</span>
              </div>
              <div class="truncate text-[10px] text-zinc-400">you</div>
            </div>
          </div>
          <Show when={props.peerList.length === 0}>
            <p class="px-1.5 py-1 text-xs text-zinc-400">No devices connected</p>
          </Show>
          <For each={props.peerList}>
            {(p) => (
              <div class="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: p.color }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-zinc-800">{p.name}</div>
                  <div class="truncate text-[10px] text-zinc-400">
                    {p.id.slice(0, 6)}
                    <Show when={props.peerStates[p.id]}>
                      <span class="ml-1">· ice:{props.peerStates[p.id].ice}</span>
                    </Show>
                  </div>
                </div>
                <Show when={p.media && p.media !== 'none'}>
                  <span class="text-xs">{p.media === 'video' ? '📹' : '🎙️'}</span>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* TRANSFERS */}
        <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          <span class="flex items-center justify-between">
            <span>Transfers</span>
            <span class="font-normal text-zinc-400">
              {props.transfers.filter((t) => !t.done).length} active, {props.transfers.filter((t) => t.done).length} done
            </span>
          </span>
        </div>
        <div class="mt-1.5 mb-4 space-y-1.5">
          <Show when={props.transfers.length === 0}>
            <p class="px-1.5 py-1 text-xs text-zinc-400">No active transfers</p>
          </Show>
          <For each={props.transfers.slice(0, 6)}>
            {(t) => (
              <div class="flex items-center gap-2 rounded-md px-1.5 py-1">
                <span class="text-sm">{t.dir === 'send' ? '↑' : '↓'}</span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-zinc-700">{t.name}</div>
                  <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                    <div class="h-full rounded-full bg-zinc-900 transition-all" classList={{ 'bg-emerald-500': t.done }} style={{ width: `${Math.round(t.progress * 100)}%` }} />
                  </div>
                </div>
                <span class="shrink-0 text-[10px] text-zinc-400">{t.done ? 'done' : `${Math.round(t.progress * 100)}%`}</span>
              </div>
            )}
          </For>
        </div>

        {/* RECEIVED */}
        <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Received</div>
        <div class="mt-1.5 space-y-1">
          <Show when={props.received.length === 0}>
            <p class="px-1.5 py-1 text-xs text-zinc-400">No files received yet</p>
          </Show>
          <For each={props.received.slice(0, 8)}>
            {(f) => (
              <div class="flex items-center gap-2 rounded-md px-1.5 py-1">
                <span class="text-sm">{fileEmoji(f.mime)}</span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-zinc-700">{f.name}</div>
                  <div class="text-[10px] text-zinc-400">{formatBytes(f.size)} · from {f.from} · {formatTime(f.time)}</div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* IPFS + Debug toggle + Leave */}
      <div class="border-t border-zinc-200 px-5 py-2">
        <div class="mb-2 flex items-center justify-between gap-1.5 text-[11px] text-zinc-400">
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full" classList={{ 'bg-emerald-500': props.ipfsStatus === 'ready', 'bg-amber-500 animate-pulse-soft': props.ipfsStatus === 'init', 'bg-rose-500': props.ipfsStatus === 'error' }} />
            {props.ipfsLabel}
          </span>
          <button type="button" onClick={() => props.setShowDebug(!props.showDebug)} class="rounded border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50">
            🐛 Debug
          </button>
        </div>
        <button type="button" onClick={props.onLeave} class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600">
          Leave room
        </button>
      </div>

      {/* Tabs */}
      <div class="flex gap-1.5 border-t border-zinc-200 p-3">
        <button type="button" onClick={() => props.setTab('files')} class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition" classList={{ 'bg-zinc-900 text-white': props.tab === 'files', 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200': props.tab !== 'files' }}>
          <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Files
        </button>
        <button type="button" onClick={() => props.setTab('chat')} class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition" classList={{ 'bg-zinc-900 text-white': props.tab === 'chat', 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200': props.tab !== 'chat' }}>
          <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Chat
        </button>
      </div>
    </>
  )
}

/* ---- Debug console (overlay) ---- */
function DebugConsole(props: { entries: DebugEntry[]; onClose: () => void; onClear: () => void }) {
  let box: HTMLDivElement | undefined
  createEffect(() => {
    if (box) box.scrollTop = box.scrollHeight
  })
  const colorFor = (l: string) => l === 'ok' ? 'text-emerald-600' : l === 'warn' ? 'text-amber-600' : l === 'error' ? 'text-rose-600' : 'text-sky-600'
  return (
    <div class="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-3" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="flex h-[60vh] w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <span class="text-xs font-semibold text-zinc-700">🐛 Pairing debug console</span>
          <div class="flex gap-1.5">
            <button type="button" onClick={props.onClear} class="rounded border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50">Clear</button>
            <button type="button" onClick={props.onClose} class="rounded border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50">Close</button>
          </div>
        </div>
        <div ref={box} class="min-h-0 flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed">
          <Show when={props.entries.length === 0}>
            <div class="text-zinc-500">No events yet…</div>
          </Show>
          <For each={props.entries}>
            {(e) => (
              <div class="whitespace-pre-wrap break-words text-zinc-300">
                <span class="text-zinc-600">{new Date(e.t).toLocaleTimeString()}</span>{' '}
                <span class={colorFor(e.level)}>[{e.tag}]</span>{' '}
                <span>{e.text}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

/* ---- Files pane ---- */
function FilesPane(props: {
  onSendFile: (f: File) => void
  ipfsReady: boolean
  received: { id: string; cid: string; name: string; size: number; mime: string; from: string; time: number }[]
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  let fileInput: HTMLInputElement | undefined
  const [dragging, setDragging] = createSignal(false)
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); const fs = e.dataTransfer?.files; if (fs) for (const f of Array.from(fs)) props.onSendFile(f) }
  return (
    <div class="min-h-0 flex-1 overflow-y-auto bg-zinc-50">
      <div class="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-6 sm:px-8">
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-zinc-900">Files</h1>
          <p class="mt-0.5 text-sm text-zinc-500">
            Send files peer-to-peer via IPFS.{' '}
            <Show when={!props.ipfsReady}><span class="text-amber-600">Starting IPFS node…</span></Show>
          </p>
        </div>
        <div
          role="button" tabIndex={0}
          onClick={() => fileInput?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition"
          classList={{ 'border-zinc-900 bg-white': dragging(), 'border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50': !dragging() }}
        >
          <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500" classList={{ 'bg-zinc-900 text-white': dragging() }}>
            <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6"><path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </div>
          <p class="text-sm font-medium text-zinc-700">{dragging() ? 'Drop to send' : 'Drop files here or click to browse'}</p>
          <p class="mt-1 text-xs text-zinc-400"><Show when={props.ipfsReady} fallback="Starting IPFS node…">Files are published to IPFS and shared with all peers</Show></p>
          <input ref={fileInput} type="file" class="hidden" multiple onChange={(e) => { const fs = (e.currentTarget as HTMLInputElement).files; if (fs) for (const f of Array.from(fs)) props.onSendFile(f); if (fileInput) fileInput.value = '' }} />
        </div>
        <div>
          <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Received</h2>
          <Show when={props.received.length === 0}>
            <div class="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-400">No files received yet</div>
          </Show>
          <div class="space-y-2">
            <For each={props.received}>
              {(f) => (
                <div class="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">{fileEmoji(f.mime)}</div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-zinc-900">{f.name}</div>
                    <div class="flex items-center gap-1.5 text-[11px] text-zinc-400"><span>{formatBytes(f.size)}</span><span>·</span><span>from {f.from}</span><span>·</span><span>{formatTime(f.time)}</span></div>
                    <div class="mt-0.5 font-mono text-[10px] text-zinc-400">{shortCid(f.cid)}</div>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <button type="button" onClick={() => props.onDownload(f.cid, f.name, f.size, f.from)} class="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 active:scale-95">Download</button>
                    <a href={gatewayUrl(f.cid)} target="_blank" rel="noreferrer" class="text-[10px] text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline">gateway ↗</a>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Chat pane ---- */
function ChatPane(props: {
  name: string; color: string
  messages: ChatMessage[]; localStream: MediaStream | null; remoteStreams: Record<string, MediaStream>
  peers: Record<string, { id: string; name: string; color: string }>
  callState: string; micEnabled: boolean; camEnabled: boolean
  onStartAudio: () => void; onStartVideo: () => void; onEndCall: () => void
  onToggleMic: () => void; onToggleCam: () => void
  onSendText: (t: string) => void
  onDownload: (cid: string, name: string, size: number, from: string) => void
  showDebug: boolean; setShowDebug: (v: boolean) => void
  debugEntries: DebugEntry[]; onClearDebug: () => void
}) {
  const [text, setText] = createSignal('')
  let textarea: HTMLTextAreaElement | undefined
  let scrollEl: HTMLDivElement | undefined
  const hasRemote = () => Object.keys(props.remoteStreams).length > 0
  const inCall = () => props.callState !== 'idle'
  const showTiles = () => inCall() || hasRemote()

  createEffect(() => {
    queueMicrotask(() => { if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight })
  })

  const send = () => {
    const t = text().trim()
    if (!t) return
    props.onSendText(t)
    setText('')
    if (textarea) textarea.style.height = 'auto'
  }
  const onInput = () => { if (textarea) { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px' } }

  const isSelf = (m: ChatMessage) => m.self
  const showHeader = (i: number) => {
    const m = props.messages[i]
    if (m.kind === 'system') return false
    const prev = props.messages[i - 1]
    if (!prev || prev.kind === 'system') return true
    return prev.peerId !== m.peerId
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-zinc-50">
      <Show when={showTiles()}>
        <div class="border-b border-zinc-200 bg-white">
          <div class="flex gap-2 overflow-x-auto p-3">
            <Show when={inCall() && props.localStream}>
              <VideoTile stream={props.localStream!} muted label="You" color={props.color} video={props.callState === 'video' && props.camEnabled} camOff={!props.camEnabled && props.callState === 'video'} />
            </Show>
            <For each={Object.entries(props.remoteStreams)}>
              {([id, stream]) => {
                const p = props.peers[id]
                const hasVideo = stream.getVideoTracks().filter((t) => t.enabled && t.readyState === 'live').length > 0
                return <VideoTile stream={stream} label={p?.name ?? 'Peer'} color={p?.color ?? '#a1a1aa'} video={hasVideo} />
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Call controls + debug toggle */}
      <div class="flex items-center justify-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <Show when={inCall()} fallback={
          <>
            <span class="mr-1 text-xs text-zinc-400">{hasRemote() ? 'Peer is live · join with' : 'Start a call'}</span>
            <CtrlBtn kind="ghost" onClick={props.onStartAudio}>🎙️ Audio</CtrlBtn>
            <CtrlBtn kind="ghost" onClick={props.onStartVideo}>📹 Video</CtrlBtn>
          </>
        }>
          <CtrlBtn kind="toggle" active={props.micEnabled} onClick={props.onToggleMic}>{props.micEnabled ? '🎙️' : '🔇'}</CtrlBtn>
          <Show when={props.callState === 'video'}>
            <CtrlBtn kind="toggle" active={props.camEnabled} onClick={props.onToggleCam}>{props.camEnabled ? '📹' : '🚫'}</CtrlBtn>
          </Show>
          <CtrlBtn kind="danger" onClick={props.onEndCall}>
            <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(135 12 12)" /></svg>
            End
          </CtrlBtn>
        </Show>
        <button type="button" onClick={() => props.setShowDebug(!props.showDebug)} class="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50">🐛 Debug</button>
      </div>

      {/* Messages */}
      <div ref={scrollEl} class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div class="mx-auto flex max-w-2xl flex-col gap-1">
          <For each={props.messages}>
            {(m, i) => (
              <Show when={m.kind !== 'system'} fallback={
                <div class="my-2 flex justify-center">
                  <span class="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-400">{m.name} {m.text}</span>
                </div>
              }>
                <div class="flex animate-fade-in-up items-end gap-2" classList={{ 'flex-row-reverse': isSelf(m) }}>
                  <div class="w-7 shrink-0">
                    <Show when={showHeader(i())}>
                      <span class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{m.name.slice(0, 2).toUpperCase()}</span>
                    </Show>
                  </div>
                  <div class={`flex min-w-0 max-w-[80%] flex-col ${isSelf(m) ? 'items-end' : 'items-start'}`}>
                    <Show when={showHeader(i())}>
                      <div class="mb-0.5 flex items-center gap-1.5 px-1">
                        <span class="text-xs font-medium text-zinc-700">{isSelf(m) ? 'You' : m.name}</span>
                        <span class="text-[10px] text-zinc-400">{formatTime(m.time)}</span>
                      </div>
                    </Show>
                    <Show when={m.kind === 'file' && m.file} fallback={
                      <div class="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]" classList={{ 'rounded-br-md bg-zinc-900 text-white': isSelf(m), 'rounded-bl-md border border-zinc-200 bg-white text-zinc-800': !isSelf(m) }}>
                        {m.text}
                      </div>
                    }>
                      <FileBubble file={m.file!} self={isSelf(m)} onDownload={props.onDownload} from={m.name} />
                    </Show>
                  </div>
                </div>
              </Show>
            )}
          </For>
          <Show when={props.messages.length === 0}>
            <div class="mt-10 text-center text-sm text-zinc-400">No messages yet. Say hello 👋</div>
          </Show>
        </div>
      </div>

      {/* Input */}
      <div class="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div class="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textarea} value={text()} rows={1} placeholder="Type a message…"
            onInput={(e) => { setText(e.currentTarget.value); onInput() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            class="min-h-10 max-h-[140px] w-full flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm leading-5 outline-none transition focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
          />
          <button type="button" onClick={send} disabled={!text().trim()} class="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30" title="Send">
            <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="m22 2-7 20-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </div>

      <Show when={props.showDebug}>
        <DebugConsole entries={props.debugEntries} onClose={() => props.setShowDebug(false)} onClear={props.onClearDebug} />
      </Show>
    </div>
  )
}

/* ---- File bubble ---- */
function FileBubble(props: {
  file: { cid: string; name: string; size: number; mime: string }
  self: boolean
  from: string
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  return (
    <div class="w-60 max-w-[80vw] rounded-2xl border p-2.5 sm:w-64" classList={{ 'rounded-br-md border-zinc-800 bg-zinc-900 text-white': props.self, 'rounded-bl-md border-zinc-200 bg-white text-zinc-800': !props.self }}>
      <div class="flex items-center gap-2.5">
        <span class="text-xl">{fileEmoji(props.file.mime)}</span>
        <div class="min-w-0 flex-1">
          <div class="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{props.file.name}</div>
          <div class="text-[11px] text-zinc-400">{formatBytes(props.file.size)}</div>
        </div>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 border-t border-current/10 pt-2">
        <span class="font-mono text-[10px] text-zinc-400">{shortCid(props.file.cid)}</span>
        <div class="flex items-center gap-2">
          <a href={gatewayUrl(props.file.cid)} target="_blank" rel="noreferrer" class="text-[10px] underline-offset-2 hover:underline text-zinc-300">gateway ↗</a>
          <button type="button" onClick={() => props.onDownload(props.file.cid, props.file.name, props.file.size, props.from)} class="rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-900 transition hover:bg-zinc-100 active:scale-95">Download</button>
        </div>
      </div>
    </div>
  )
}

/* ---- Video tile ---- */
function VideoTile(props: { stream: MediaStream; muted?: boolean; label: string; color: string; video: boolean; camOff?: boolean }) {
  let video: HTMLVideoElement | undefined
  createEffect(() => { const s = props.stream; if (video && s) { video.srcObject = s; video.play().catch(() => {}) } })
  const showAvatar = () => !props.video || props.camOff
  return (
    <div class="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 sm:h-28 sm:w-40">
      <video ref={video} autoplay playsinline muted={props.muted} class="h-full w-full object-cover" classList={{ 'opacity-0': showAvatar() }} />
      <Show when={showAvatar()}>
        <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
          <span class="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: props.color }}>{props.label.slice(0, 2).toUpperCase()}</span>
        </div>
      </Show>
      <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
        <span class="truncate text-[11px] font-medium text-white">{props.label}</span>
        <Show when={props.muted}><span class="rounded bg-black/40 px-1 text-[9px] uppercase text-zinc-200">you</span></Show>
      </div>
    </div>
  )
}

/* ---- Control button ---- */
function CtrlBtn(props: { kind: 'ghost' | 'toggle' | 'danger'; active?: boolean; onClick: () => void; children: any }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-95'
  const styles = () => {
    if (props.kind === 'danger') return 'bg-rose-500 text-white hover:bg-rose-600'
    if (props.kind === 'toggle') return props.active ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
    return 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
  }
  return <button type="button" onClick={props.onClick} class={`${base} ${styles()}`}>{props.children}</button>
}

// Register the Web Component. Props are read as HTML attributes (component-
// register maps room-name → roomName). Default values ensure the component
// always has something to render with before attributes are set.
customElement('fybeam-room', {
  room: '',
  name: '',
  color: '#0ea5e9',
  roomName: '',
}, FybeamRoom)

export default FybeamRoom
