import { For, Show, createSignal, createEffect } from 'solid-js'
import { formatBytes, formatTime } from '../lib/utils'
import { renderQrToCanvas } from '../lib/qr'
import type { PendingRequest, ReceivedFile, Transfer, PeerInfo, ConnStatus, IpfsStatus } from '../types'

interface StatusInfo {
  label: string
  dot: string
  text: string
}

/** Left sidebar: brand, room info, status, join requests, QR (creator only),
 *  devices, transfers, received, IPFS, leave. */
export default function Sidebar(props: {
  room: string
  roomName: string
  name: string
  color: string
  isCreator: boolean
  shareUrl: string
  copiedLink: boolean
  onCopyLink: () => void
  onDownloadQr: () => void
  statusInfo: StatusInfo
  signaling: { open: number; total: number }
  waitingLong: boolean
  connStatus: ConnStatus
  peerList: PeerInfo[]
  peerStates: Record<string, { ice: string; conn: string }>
  ipfsLabel: string
  ipfsStatus: IpfsStatus
  transfers: Transfer[]
  received: ReceivedFile[]
  onLeave: () => void
  pendingRequests: PendingRequest[]
  onApprove: (peerId: string) => void
  onDeny: (peerId: string) => void
}) {
  const [qrExpanded, setQrExpanded] = createSignal(false)
  let qrCanvas: HTMLCanvasElement | undefined
  // Render the QR when the section expands (canvas becomes available).
  createEffect(() => {
    if (qrExpanded() && qrCanvas) {
      renderQrToCanvas(qrCanvas, props.shareUrl, 112).catch((e) => console.error('QR render failed', e))
    }
  })
  return (
    <>
      {/* Brand */}
      <div class="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4">
            <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="text-base font-semibold tracking-tight">fybeam</span>
      </div>

      {/* Room info + status */}
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
            No peer found yet. Both sides must be on this page at the same time with the same room code ({props.room}).
            If the Debug console shows "handshake: peer discovered" but then "JOIN ERROR", the WebRTC connection (ICE)
            is failing — usually NAT/firewall blocking direct P2P.
          </div>
        </Show>
        <Show when={props.connStatus === 'handshaking'}>
          <div class="mt-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] leading-relaxed text-sky-700">
            Peer found via signaling — establishing WebRTC connection… If this fails with JOIN ERROR, check the Debug
            console.
          </div>
        </Show>
      </div>

      {/* Pending join requests (creator only) */}
      <Show when={props.isCreator && props.pendingRequests.length > 0}>
        <div class="border-y border-amber-100 bg-amber-50/60 px-5 py-3">
          <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            Join requests ({props.pendingRequests.length})
          </div>
          <div class="space-y-2">
            <For each={props.pendingRequests}>
              {(req) => (
                <div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2 py-1.5">
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: req.color }}
                  >
                    {req.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-xs font-medium text-zinc-800">{req.name}</div>
                    <div class="text-[10px] text-zinc-400">wants to join</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => props.onApprove(req.peerId)}
                    class="flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-600"
                  >
                    <svg viewBox="0 0 24 24" fill="none" class="h-3 w-3"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDeny(req.peerId)}
                    class="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" class="h-3 w-3"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>
                    Deny
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Share room — collapsed QR icon, expands downward on click (creator only) */}
      <Show when={props.isCreator}>
        <div class="border-y border-zinc-100 bg-zinc-50/60">
          {/* Collapsed header (always visible, no hover effect) */}
          <button
            type="button"
            onClick={() => setQrExpanded((v) => !v)}
            class="flex w-full items-center justify-between px-5 py-2.5 text-left"
            title="Share room via QR code"
          >
            <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4 text-zinc-500">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" />
                <path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              Share room
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              class="h-4 w-4 text-zinc-400 transition-transform"
              classList={{ 'rotate-180': qrExpanded() }}
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          {/* Expanded content (canvas + actions) */}
          <Show when={qrExpanded()}>
            <div class="px-5 pb-3">
              <div class="flex justify-center">
                <div class="rounded-lg border border-zinc-200 bg-white p-1.5 shadow-sm">
                  <canvas ref={qrCanvas} class="block h-28 w-28" aria-label="QR code for room share link" />
                </div>
              </div>
              <p class="mt-1.5 text-center text-[10px] leading-relaxed text-zinc-400">Scan to open with this room code</p>
              <div class="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={props.onCopyLink}
                  class="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  <Show when={props.copiedLink} fallback={
                    <svg viewBox="0 0 24 24" fill="none" class="h-3 w-3"><path d="M8 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2M8 5a2 2 0 0 0 0 4h6M8 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  }>
                    <svg viewBox="0 0 24 24" fill="none" class="h-3 w-3"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </Show>
                  {props.copiedLink ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={props.onDownloadQr}
                  class="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" class="h-3 w-3"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  Save QR
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Devices / Transfers / Received (scrollable) */}
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <SectionLabel>Devices</SectionLabel>
        <div class="mt-1.5 mb-4">
          <DeviceRow name={props.name} sub="you" color={props.color} self />
          <Show when={props.peerList.length === 0}>
            <EmptyRow>No devices connected</EmptyRow>
          </Show>
          <For each={props.peerList}>
            {(p) => (
              <DeviceRow
                name={p.name}
                sub={`${p.id.slice(0, 6)}${props.peerStates[p.id] ? ` · ice:${props.peerStates[p.id].ice}` : ''}`}
                color={p.color}
                media={p.media}
              />
            )}
          </For>
        </div>

        <SectionLabel>
          <span class="flex items-center justify-between">
            <span>Transfers</span>
            <span class="font-normal text-zinc-400">
              {props.transfers.filter((t) => !t.done).length} active, {props.transfers.filter((t) => t.done).length} done
            </span>
          </span>
        </SectionLabel>
        <div class="mt-1.5 mb-4 space-y-1.5">
          <Show when={props.transfers.length === 0}>
            <EmptyRow>No active transfers</EmptyRow>
          </Show>
          <For each={props.transfers.slice(0, 6)}>
            {(t) => (
              <div class="flex items-center gap-2 rounded-md px-1.5 py-1">
                <span class="text-zinc-400">{t.dir === 'send' ? <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg> : <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-xs font-medium text-zinc-700">{t.name}</span>
                    <span class="shrink-0 text-[10px] text-zinc-400">{formatBytes(t.size)}</span>
                  </div>
                  <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      class="h-full rounded-full bg-zinc-900 transition-all"
                      classList={{ 'bg-emerald-500': t.done }}
                      style={{ width: `${Math.round(t.progress * 100)}%` }}
                    />
                  </div>
                </div>
                <span class="shrink-0 text-[10px] text-zinc-400">{t.done ? 'done' : `${Math.round(t.progress * 100)}%`}</span>
              </div>
            )}
          </For>
        </div>

        <SectionLabel>Received</SectionLabel>
        <div class="mt-1.5 space-y-1">
          <Show when={props.received.length === 0}>
            <EmptyRow>No files received yet</EmptyRow>
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

      {/* IPFS + Debug + Leave */}
      <div class="border-t border-zinc-200 px-5 py-2">
        <div class="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span
            class="h-1.5 w-1.5 rounded-full"
            classList={{
              'bg-emerald-500': props.ipfsStatus === 'ready',
              'bg-amber-500 animate-pulse-soft': props.ipfsStatus === 'init',
              'bg-rose-500': props.ipfsStatus === 'error',
            }}
          />
          {props.ipfsLabel}
        </div>
        <button
          type="button"
          onClick={props.onLeave}
          class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          Leave room
        </button>
      </div>
    </>
  )
}

function SectionLabel(props: { children: any }) {
  return <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{props.children}</div>
}

function EmptyRow(props: { children: any }) {
  return <p class="px-1.5 py-1 text-xs text-zinc-400">{props.children}</p>
}

function DeviceRow(props: { name: string; sub: string; color: string; self?: boolean; media?: string }) {
  return (
    <div class="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
      <span
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: props.color }}
      >
        {props.name.slice(0, 2).toUpperCase()}
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-800">
          {props.name}
          <Show when={props.self}>
            <span class="rounded bg-zinc-900 px-1 py-0.5 text-[9px] font-semibold text-white">YOU</span>
          </Show>
        </div>
        <div class="truncate text-[10px] text-zinc-400">{props.sub}</div>
      </div>
      <Show when={props.media && props.media !== 'none'}>
        <span class="text-zinc-400">{props.media === 'video' ? <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="2" /><path d="m22 8-6 4 6 4V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg> : <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}</span>
      </Show>
    </div>
  )
}
