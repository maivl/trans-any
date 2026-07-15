import { For, Show, createSignal, onMount, createEffect } from 'solid-js'
import type { Profile } from '../types'
import {
  peers, connStatus, ipfsStatus, signaling, waitingLong, tab, setTab, transfers, received,
} from '../store'
import { formatBytes, formatTime, fileEmoji } from '../lib/utils'
import { buildShareUrl, renderQrToCanvas, renderQrDataUrl } from '../lib/qr'
import { pushToast } from '../store'

export default function Sidebar(props: { profile: Profile; onLeave: () => void }) {
  const [copied, setCopied] = createSignal(false)
  const [linkCopied, setLinkCopied] = createSignal(false)
  const peerList = () => Object.values(peers())
  const activeTransfers = () => transfers().filter((t) => !t.done)
  const doneTransfers = () => transfers().filter((t) => t.done)
  const receivedFiles = () => received().filter((f) => f.cid)
  let qrCanvas: HTMLCanvasElement | undefined

  const shareUrl = () => buildShareUrl(props.profile.room)

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(props.profile.room)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    } catch {
      pushToast('Could not copy link', 'error')
    }
  }

  const downloadQr = async () => {
    try {
      const dataUrl = await renderQrDataUrl(shareUrl(), 480)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `fybeam-room-${props.profile.room}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      pushToast('Could not save QR', 'error')
    }
  }

  // Render the QR to the inline canvas whenever the room changes / on mount.
  createEffect(() => {
    const c = qrCanvas
    if (c) {
      renderQrToCanvas(c, shareUrl(), 224).catch((e) => console.error('QR render failed', e))
    }
  })
  // also render once on mount (in case effect ran before canvas ref attached)
  onMount(() => {
    if (qrCanvas) renderQrToCanvas(qrCanvas, shareUrl(), 224).catch(() => {})
  })

  const statusInfo = () => {
    const s = connStatus()
    if (s === 'connected') return { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-600' }
    if (s === 'connecting') return { label: 'Waiting', dot: 'bg-amber-500', text: 'text-amber-600' }
    return { label: 'Disconnected', dot: 'bg-rose-500', text: 'text-rose-600' }
  }

  const ipfsLabel = () =>
    ipfsStatus() === 'ready' ? 'IPFS ready' : ipfsStatus() === 'init' ? 'IPFS starting…' : 'IPFS error'

  return (
    <aside class="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:w-72">
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

      {/* Room block */}
      <div class="px-5 pb-4">
        <div class="truncate text-sm font-semibold text-zinc-900">{props.profile.roomName}</div>
        <button
          type="button"
          onClick={copyRoom}
          class="group mt-0.5 flex items-center gap-1.5 font-mono text-xs text-zinc-400 transition hover:text-zinc-700"
          title="Copy room code"
        >
          <span>room / {props.profile.room}</span>
          <span class="text-zinc-300 group-hover:text-zinc-700">{copied() ? '✓' : '⧉'}</span>
        </button>
        {/* Status */}
        <div class={`mt-2 flex items-center gap-1.5 text-xs font-medium ${statusInfo().text}`}>
          <span class={`h-1.5 w-1.5 rounded-full ${statusInfo().dot}`} />
          {statusInfo().label}
        </div>
        {/* Signaling relay count */}
        <div class="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span class="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Signaling {signaling().open}/{signaling().total} relays
        </div>
        {/* Waiting hint */}
        <Show when={waitingLong() && connStatus() !== 'connected'}>
          <div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700">
            No peer found yet. Make sure both use the same room code and are
            online. Pairing can take ~10s. If it stays stuck, your network may
            be blocking the signaling relays.
          </div>
        </Show>
      </div>

      {/* Inline QR code — always visible, no modal */}
      <div class="border-y border-zinc-100 bg-zinc-50/60 px-5 py-4">
        <div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Share room
        </div>
        <div class="flex justify-center">
          <div class="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
            <canvas ref={qrCanvas} class="block h-44 w-44" aria-label="QR code for room share link" />
          </div>
        </div>
        <p class="mt-2 text-center text-[10px] leading-relaxed text-zinc-400">
          Scan to open fybeam with this room code
        </p>
        <div class="mt-2.5 flex gap-1.5">
          <button
            type="button"
            onClick={copyLink}
            class="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
            title="Copy share link"
          >
            {linkCopied() ? '✓ Copied' : '⧉ Copy link'}
          </button>
          <button
            type="button"
            onClick={downloadQr}
            class="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
            title="Save QR as PNG"
          >
            ⬇ Save QR
          </button>
        </div>
        <div class="mt-1.5 truncate rounded bg-white px-1.5 py-1 text-center font-mono text-[9px] text-zinc-400" title={shareUrl()}>
          {shareUrl()}
        </div>
      </div>

      {/* Scrollable middle: devices / transfers / received */}
      <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {/* DEVICES */}
        <SectionLabel>Devices</SectionLabel>
        <div class="mt-1.5 mb-5">
          {/* self */}
          <DeviceRow name={`${props.profile.name}`} sub="you" color={props.profile.color} self />
          <Show when={peerList().length === 0}>
            <EmptyRow>No devices connected</EmptyRow>
          </Show>
          <For each={peerList()}>
            {(p) => <DeviceRow name={p.name} sub={p.id.slice(0, 6)} color={p.color} media={p.media} />}
          </For>
        </div>

        {/* TRANSFERS */}
        <SectionLabel>
          <span class="flex items-center justify-between">
            <span>Transfers</span>
            <span class="font-normal text-zinc-400">
              {activeTransfers().length} active, {doneTransfers().length} done
            </span>
          </span>
        </SectionLabel>
        <div class="mt-1.5 mb-5 space-y-1.5">
          <Show when={transfers().length === 0}>
            <EmptyRow>No active transfers</EmptyRow>
          </Show>
          <For each={transfers().slice(0, 6)}>
            {(t) => (
              <div class="flex items-center gap-2 rounded-md px-1.5 py-1">
                <span class="text-sm">{t.dir === 'send' ? '↑' : '↓'}</span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-zinc-700">{t.name}</div>
                  <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      class="h-full rounded-full bg-zinc-900 transition-all"
                      classList={{ 'bg-emerald-500': t.done }}
                      style={{ width: `${Math.round(t.progress * 100)}%` }}
                    />
                  </div>
                </div>
                <span class="shrink-0 text-[10px] text-zinc-400">
                  {t.done ? 'done' : `${Math.round(t.progress * 100)}%`}
                </span>
              </div>
            )}
          </For>
        </div>

        {/* RECEIVED */}
        <SectionLabel>Received</SectionLabel>
        <div class="mt-1.5 space-y-1">
          <Show when={receivedFiles().length === 0}>
            <EmptyRow>No files received yet</EmptyRow>
          </Show>
          <For each={receivedFiles().slice(0, 8)}>
            {(f) => (
              <div class="flex items-center gap-2 rounded-md px-1.5 py-1">
                <span class="text-sm">{fileEmoji(f.mime)}</span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-zinc-700">{f.name}</div>
                  <div class="text-[10px] text-zinc-400">
                    {formatBytes(f.size)} · from {f.from} · {formatTime(f.time)}
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* IPFS + Leave */}
      <div class="border-t border-zinc-200 px-5 py-3">
        <div class="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span
            class="h-1.5 w-1.5 rounded-full"
            classList={{
              'bg-emerald-500': ipfsStatus() === 'ready',
              'bg-amber-500 animate-pulse-soft': ipfsStatus() === 'init',
              'bg-rose-500': ipfsStatus() === 'error',
            }}
          />
          {ipfsLabel()}
        </div>
        <button
          type="button"
          onClick={props.onLeave}
          class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          Leave room
        </button>
      </div>

      {/* Tabs */}
      <div class="flex gap-1.5 border-t border-zinc-200 p-3">
        <TabButton active={tab() === 'files'} onClick={() => setTab('files')} icon="files">
          Files
        </TabButton>
        <TabButton active={tab() === 'chat'} onClick={() => setTab('chat')} icon="chat">
          Chat
        </TabButton>
      </div>
    </aside>
  )
}

function SectionLabel(props: { children: any }) {
  return (
    <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
      {props.children}
    </div>
  )
}

function EmptyRow(props: { children: any }) {
  return <p class="px-1.5 py-1 text-xs text-zinc-400">{props.children}</p>
}

function DeviceRow(props: {
  name: string
  sub: string
  color: string
  self?: boolean
  media?: string
}) {
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
        <span class="text-xs">{props.media === 'video' ? '📹' : '🎙️'}</span>
      </Show>
    </div>
  )
}

function TabButton(props: { active: boolean; onClick: () => void; icon: string; children: any }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition"
      classList={{
        'bg-zinc-900 text-white': props.active,
        'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700': !props.active,
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
