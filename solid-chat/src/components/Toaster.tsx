import { For, Show } from 'solid-js'
import { toasts } from '../store'

export default function Toaster() {
  return (
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <For each={toasts()}>
        {(t) => (
          <div
            class="animate-fade-in-up pointer-events-auto flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3.5 py-2.5 text-sm shadow-lg backdrop-blur"
            classList={{
              'border-emerald-600/50 text-emerald-300': t.kind === 'success',
              'border-rose-600/50 text-rose-300': t.kind === 'error',
              'text-zinc-200': t.kind === 'info',
            }}
          >
            <Show when={t.kind === 'success'}>✓</Show>
            <Show when={t.kind === 'error'}>⚠</Show>
            <span>{t.text}</span>
          </div>
        )}
      </For>
    </div>
  )
}
