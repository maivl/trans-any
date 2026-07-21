import { For, Show } from 'solid-js'
import { toasts } from '../store'
import { Icon } from './icons'

/** Fixed-position toast notifications (top-center, with debounce/merge). */
export default function Toaster() {
  return (
    <div class="pointer-events-none fixed top-4 left-1/2 z-50 flex w-full max-w-[80vw] -translate-x-1/2 flex-col items-center gap-2 sm:max-w-md">
      <For each={toasts()}>
        {(t) => (
          <div
            class="animate-fade-in-down pointer-events-auto flex w-fit max-w-full items-start gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm shadow-lg"
            classList={{
              'border-emerald-200 text-emerald-700': t.kind === 'success',
              'border-rose-200 text-rose-700': t.kind === 'error',
              'border-zinc-200 text-zinc-700': t.kind === 'info',
            }}
          >
            <Show when={t.kind === 'success'}><Icon name="check" class="mt-0.5 h-4 w-4 shrink-0" /></Show>
            <Show when={t.kind === 'error'}><Icon name="warn" class="mt-0.5 h-4 w-4 shrink-0" /></Show>
            <span class="break-words whitespace-pre-wrap">{t.text}</span>
            <Show when={t.count > 1}>
              <span class="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 px-1 text-[11px] font-medium text-zinc-600">{t.count}</span>
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}
