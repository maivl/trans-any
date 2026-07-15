import { For, Show } from 'solid-js'
import type { PeerInfo } from '../types'
import { peers as peersSignal } from '../store'
import { initials } from '../lib/utils'

export default function PeerList(props: { selfName: string; selfColor: string }) {
  const peerList = () => Object.values(peersSignal())

  return (
    <div class="flex h-full flex-col">
      <div class="flex items-center justify-between px-4 py-3">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Participants
        </h2>
        <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
          {peerList().length + 1}
        </span>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {/* Self */}
        <div class="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={props.selfName} color={props.selfColor} />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 truncate text-sm font-medium">
              {props.selfName}
              <span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                YOU
              </span>
            </div>
            <div class="text-[11px] text-zinc-500">you</div>
          </div>
        </div>

        <Show when={peerList().length === 0}>
          <div class="px-3 py-6 text-center text-xs text-zinc-600">
            No one else here yet.
            <br />
            Share the room code to invite peers.
          </div>
        </Show>

        <For each={peerList()}>
          {(p: PeerInfo) => (
            <div class="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-800/40">
              <Avatar name={p.name} color={p.color} />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{p.name}</div>
                <div class="text-[11px] text-zinc-500">{p.id.slice(0, 8)}</div>
              </div>
              <Show when={p.media && p.media !== 'none'}>
                <span class="text-base" title={p.media}>
                  {p.media === 'video' ? '📹' : '🎙️'}
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

function Avatar(props: { name: string; color: string }) {
  return (
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
      style={{ background: props.color }}
    >
      {initials(props.name)}
    </div>
  )
}
