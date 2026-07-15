import { For, Show, createMemo } from 'solid-js'
import { Icon, type IconKey } from './icons'

export interface SlashCommand {
  cmd: string
  label: string
  desc: string
  icon: IconKey
  run: () => void
}

/**
 * Slash-command menu (Doubao-style). Appears when the user types "/" at the
 * start of (or after a space in) the input. Filters commands by the text after
 * "/". Arrow keys + Enter to select, Esc to close.
 */
export default function SlashMenu(props: {
  query: string
  commands: SlashCommand[]
  activeIndex: number
  onPick: (c: SlashCommand) => void
  onHover: (i: number) => void
}) {
  const filtered = createMemo(() => {
    const q = props.query.toLowerCase()
    return props.commands.filter((c) => c.cmd.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
  })

  return (
    <Show when={filtered().length > 0}>
      <div class="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div class="border-b border-zinc-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Quick commands
        </div>
        <div class="max-h-64 overflow-y-auto py-1">
          <For each={filtered()}>
            {(c, i) => (
              <button
                type="button"
                onMouseEnter={() => props.onHover(i())}
                onClick={() => props.onPick(c)}
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition"
                classList={{ 'bg-zinc-100': i() === props.activeIndex, 'hover:bg-zinc-50': i() !== props.activeIndex }}
              >
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500"><Icon name={c.icon} class="h-4 w-4" /></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-xs font-medium text-zinc-900">/{c.cmd}</span>
                    <span class="text-xs text-zinc-500">{c.label}</span>
                  </div>
                  <div class="truncate text-[10px] text-zinc-400">{c.desc}</div>
                </div>
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
