import { createSignal, Show, onCleanup } from 'solid-js'

export default function MessageInput(props: {
  onSend: (text: string) => void
  onFile: (file: File) => void
  sending: boolean
  sendProgress: number
  ipfsReady: boolean
}) {
  const [text, setText] = createSignal('')
  let textarea: HTMLTextAreaElement | undefined
  let fileInput: HTMLInputElement | undefined

  const send = () => {
    const t = text().trim()
    if (!t) return
    props.onSend(t)
    setText('')
    if (textarea) {
      textarea.style.height = 'auto'
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const onInput = () => {
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px'
    }
  }

  const pickFile = () => fileInput?.click()

  const onFileChange = (e: Event) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0]
    if (f) props.onFile(f)
    if (fileInput) fileInput.value = ''
  }

  return (
    <div class="shrink-0 border-t border-zinc-800 bg-zinc-900/80 px-3 py-3 backdrop-blur sm:px-6">
      <div class="mx-auto flex max-w-3xl items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          class="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={pickFile}
          disabled={props.sending || !props.ipfsReady}
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/70 text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          title={props.ipfsReady ? 'Attach file (IPFS)' : 'IPFS starting…'}
        >
          <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5">
            <path d="M21.44 11.05 12.5 19.99a5 5 0 0 1-7.07-7.07l8.99-8.99a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="relative flex-1">
          <textarea
            ref={textarea}
            value={text()}
            onInput={(e) => {
              setText(e.currentTarget.value)
              onInput()
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message…  (Enter to send, Shift+Enter for newline)"
            class="max-h-[140px] w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-2.5 text-sm leading-relaxed outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <Show when={props.sending}>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-xl">
              <div
                class="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round(props.sendProgress * 100)}%` }}
              />
            </div>
          </Show>
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!text().trim()}
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-zinc-950 transition hover:from-emerald-400 hover:to-teal-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          title="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5">
            <path d="m22 2-7 20-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <Show when={props.sending}>
        <p class="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-zinc-500">
          Publishing file to IPFS…
        </p>
      </Show>
    </div>
  )
}
