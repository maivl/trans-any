import { Show, createSignal, createEffect, onCleanup } from 'solid-js'
import { customElement, noShadowDOM } from 'solid-element'
import type { Profile } from '../types'
import { buildShareUrl, renderQrDataUrl } from '../lib/qr'
import { subscribeDebug, clearDebugLog, type DebugEntry } from '../lib/debug'
import {
  signaling, waitingLong, connStatus, ipfsStatus, messages, remoteStreams, transfers, received,
  peers, pushToast, approvalState, pendingRequests,
  localStream, callState, micEnabled, camEnabled,
} from '../store'
import { useRoom } from '../lib/useRoom'
import Sidebar from './Sidebar'
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
  const [showMobileSidebar, setShowMobileSidebar] = createSignal(false)

  const room = useRoom(profile, isCreator)

  // Subscribe debug buffer for the debug panel.
  onCleanup(subscribeDebug((entries) => setDebugEntries(entries.slice(-200))))

  const shareUrl = () => buildShareUrl(props.room)

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

  // Shared sidebar props (used by both desktop sidebar and mobile dialog).
  const sidebarProps = {
    get room() { return props.room },
    get roomName() { return props.roomName },
    get name() { return props.name },
    get color() { return props.color },
    get isCreator() { return isCreator() },
    get shareUrl() { return shareUrl() },
    get copiedLink() { return copiedLink() },
    onCopyLink: copyLink,
    onDownloadQr: downloadQr,
    get statusInfo() { return statusInfo() },
    get signaling() { return signaling() },
    get waitingLong() { return waitingLong() },
    get connStatus() { return connStatus() },
    get peerList() { return Object.values(peers()) },
    get peerStates() { return peerStates() },
    get ipfsLabel() { return ipfsLabel() },
    get ipfsStatus() { return ipfsStatus() },
    get transfers() { return transfers() },
    get received() { return received().filter((f) => f.cid) },
    onLeave: () => { setShowMobileSidebar(false); room.leave() },
    get pendingRequests() { return pendingRequests() },
    onApprove: room.approveJoiner,
    onDeny: room.denyJoiner,
  }

  return (
    <div class="flex h-full w-full bg-zinc-50 text-zinc-900">
      {/* Desktop sidebar (md+) */}
      <aside class="hidden h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex md:w-72">
        <Sidebar {...sidebarProps} />
      </aside>

      <main class="flex min-w-0 flex-1 flex-col">
        {/* Mobile top header (with menu button to open sidebar as a dialog) */}
        <header class="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <div class="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowMobileSidebar(true)}
              class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              title="Open menu"
            >
              <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
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
          <ChatPane
            name={props.name} color={props.color}
            messages={messages()} localStream={localStream()} remoteStreams={remoteStreams()} peers={peers()}
            callState={callState()} micEnabled={micEnabled()} camEnabled={camEnabled()}
            onStartAudio={() => room.startCall('audio')} onStartVideo={() => room.startCall('video')}
            onEndCall={() => room.endCall(false)} onToggleMic={room.toggleMic} onToggleCam={room.toggleCam}
            onSendText={room.handleSendText} onSendFile={room.handleSendFile} onDownload={room.handleDownload}
            setShowDebug={setShowDebug} showDebug={showDebug()}
            debugEntries={debugEntries()} onClearDebug={() => clearDebugLog()}
            ipfsReady={ipfsStatus() === 'ready'}
            received={received().filter((f) => f.cid)}
          />
        </div>
      </main>

      {/* Mobile sidebar dialog (slide-in from left) */}
      <Show when={showMobileSidebar()}>
        <div class="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileSidebar(false)}
          />
          {/* Panel */}
          <div class="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <span class="text-sm font-semibold">Room info</span>
              <button
                type="button"
                onClick={() => setShowMobileSidebar(false)}
                class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Sidebar {...sidebarProps} />
            </div>
          </div>
        </div>
      </Show>

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
