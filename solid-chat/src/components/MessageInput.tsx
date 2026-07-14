import { createSignal } from 'solid-js'

export default function MessageInput(props: { onSend: (text: string) => void }) {
  const [text, setText] = createSignal('')
  let textarea: HTMLTextAreaElement | undefined

  const send = () => {
    const t = text().trim()
    if (!t) return
    props.onSend(t)
    setText('')
    if (textarea) textarea.style.height = 'auto'
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

  return (
    <div class="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6">
      <div class="mx-auto flex max-w-2xl items-end gap-2">
        <textarea
          ref={textarea}
          value={text()}
          onInput={(e) => {
            setText(e.currentTarget.value)
            onInput()
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Type a message…"
          class="min-h-10 max-h-[140px] w-full flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm leading-5 outline-none transition focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text().trim()}
          class="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          title="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5">
            <path d="m22 2-7 20-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
