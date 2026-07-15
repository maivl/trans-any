import { Show, createSignal, createEffect, onCleanup } from 'solid-js'
import { customElement, noShadowDOM } from 'solid-element'
import type { Profile } from '../types'
import { buildShareUrl, renderQrToCanvas, renderQrDataUrl } from '../lib/qr'
import { subscribeDebug, clearDebugLog, type DebugEntry } from '../lib/debug'
import {
  signaling, waitingLong, connStatus, ipfsStatus, messages, remoteStreams, transfers, received,
  peers, tab, setTab, pushToast, approvalState, pendingRequests,
  localStream, callState, micEnabled, camEnabled,
} from '../store'
import { useRoom } from '../lib/useRoom'
import Sidebar from './Sidebar'
import FilesPane from './FilesPane'
import ChatPane from './ChatPane'
import Toaster from './Toaster'
import ApprovalOverlay from './ApprovalOverlay'

/**
 * <fybeam-room> — the whole chat experience as a single Web Component.
 * Layout: desktop sidebar + main (chat/files), mobile header + bottom tabs,
 * toasts, joiner approval overlay. All orchestration lives in useRoom.
 */
function FybeamRoom(props: { room: string; name: string; color: string; roomName: string; role: string }) {
  noShadowDOM()
  const isCreator = () => props.role === 'creator'
  const profile = (): Profile => ({
    name: props.name,
    color: props.color,
    room: props.room,
    roomName: props.roomName,
  })

  const [showDebug, setShowDebug] = createSignal(false)
  const [debugEntries, setDebugEntries] = createSignal<DebugEntry[]>([])
  const [copiedLink, setCopiedLink] = createSignal(false)
  let qrCanvas: HTMLCanvasElement | undefined

  const room = useRoom(profile, isCreator)

  // Subscribe debug buffer for the debug panel.
  onCleanup(subscribeDebug((entries) => setDebugEntries(entries.slice(-200))))

  // Render QR to the inline canvas (creator only).
  const shareUrl = () => buildShareUrl(props.room)
  createEffect(() => {
    const c = qrCanvas
    if (c) renderQrToCanvas(c, shareUrl(), 112).catch((e) => console.error('QR render failed', e))
  })

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
      return room.controller()?.getPeerStates() ?? {}
    } catch {
      return {}
    }
  }

  return (
    <div class="flex h-full w-full bg-zinc-50 text-zinc-900">
      {/* Desktop sidebar */}
      <aside class="hidden h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex md:w-72">
        <Sidebar
          room={props.room} roomName={props.roomName} name={props.name} color={props.color}
          isCreator={isCreator()}
          qrCanvas={(el: HTMLCanvasElement | undefined) => (qrCanvas = el)}
          copiedLink={copiedLink()} onCopyLink={copyLink} onDownloadQr={downloadQr}
          statusInfo={statusInfo()} signaling={signaling()} waitingLong={waitingLong()} connStatus={connStatus()}
          peerList={Object.values(peers())} peerStates={peerStates()} ipfsLabel={ipfsLabel()} ipfsStatus={ipfsStatus()}
          transfers={transfers()} received={received().filter((f) => f.cid)}
          tab={tab()} setTab={setTab} onLeave={room.leave}
          showDebug={showDebug()} setShowDebug={setShowDebug}
          debugEntries={debugEntries()} onClearDebug={() => clearDebugLog()}
          pendingRequests={pendingRequests()} onApprove={room.approveJoiner} onDeny={room.denyJoiner}
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
            <button type="button" onClick={room.leave} class="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
              Leave
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col">
          <Show when={tab() === 'files'}>
            <FilesPane onSendFile={room.handleSendFile} ipfsReady={ipfsStatus() === 'ready'} received={received().filter((f) => f.cid)} onDownload={room.handleDownload} />
          </Show>
          <Show when={tab() === 'chat'}>
            <ChatPane
              name={props.name} color={props.color}
              messages={messages()} localStream={localStream()} remoteStreams={remoteStreams()} peers={peers()}
              callState={callState()} micEnabled={micEnabled()} camEnabled={camEnabled()}
              onStartAudio={() => room.startCall('audio')} onStartVideo={() => room.startCall('video')}
              onEndCall={() => room.endCall(false)} onToggleMic={room.toggleMic} onToggleCam={room.toggleCam}
              onSendText={room.handleSendText} onSendFile={room.handleSendFile} onDownload={room.handleDownload}
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

      <Toaster />
      <Show when={!isCreator()}>
        <ApprovalOverlay room={props.room} />
      </Show>
    </div>
  )
}

// Register the Web Component.
customElement('fybeam-room', {
  room: '',
  name: '',
  color: '#0ea5e9',
  roomName: '',
  role: 'creator',
}, FybeamRoom)

export default FybeamRoom
