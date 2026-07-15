import { For, Show, createEffect } from 'solid-js'
import type { DebugEntry } from '../lib/debug'
import { Icon } from './icons'

/** Overlay console showing timestamped pairing/debug events. */
export default function DebugConsole(props: {
  entries: DebugEntry[]
  onClose: () => void
  onClear: () => void
}) {
  let box: HTMLDivElement | undefined
  createEffect(() => {
    if (box) box.scrollTop = box.scrollHeight
  })
  const colorFor = (l: string) =>
    l === 'ok' ? 'text-emerald-600' : l === 'warn' ? 'text-amber-600' : l === 'error' ? 'text-rose-600' : 'text-sky-600'

  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-3"
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div class="flex h-[60vh] w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <span class="flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><Icon name="debug" class="h-4 w-4" /> Pairing debug console</span>
          <div class="flex gap-1.5">
            <button
              type="button"
              onClick={props.onClear}
              class="rounded border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="rounded border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50"
            >
              Close
            </button>
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
