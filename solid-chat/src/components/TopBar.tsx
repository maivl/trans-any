import { Show, createSignal } from 'solid-js'
import type { IpfsStatus } from '../types'

export default function TopBar(props: {
  room: string
  peerCount: number
  ipfsStatus: IpfsStatus
  onLeave: () => void
}) {
  const [copied, setCopied] = createSignal(false)

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(props.room)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const ipfsLabel = () =>
    props.ipfsStatus === 'ready' ? 'IPFS ready' : props.ipfsStatus === 'init' ? 'IPFS starting…' : 'IPFS error'
  const ipfsColor = () =>
    props.ipfsStatus === 'ready' ? 'bg-emerald-500' : props.ipfsStatus === 'init' ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <header class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/80 px-4 backdrop-blur">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600">
          <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4 text-zinc-950">
            <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold">P2P Chat</span>
            <button
              type="button"
              onClick={copyRoom}
              class="group flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 font-mono text-xs tracking-widest transition hover:border-emerald-500"
              title="Copy room code"
            >
              {props.room}
              <span class="text-zinc-500 group-hover:text-emerald-400">
                {copied() ? '✓' : '⧉'}
              </span>
            </button>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-zinc-500">
            <span class="flex items-center gap-1">
              <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {props.peerCount} {props.peerCount === 1 ? 'peer' : 'peers'}
            </span>
            <span class="text-zinc-700">·</span>
            <span class="flex items-center gap-1">
              <span class={`h-1.5 w-1.5 rounded-full ${ipfsColor()}`} />
              {ipfsLabel()}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={props.onLeave}
        class="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-rose-500 hover:text-rose-400"
      >
        <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Leave
      </button>
    </header>
  )
}
