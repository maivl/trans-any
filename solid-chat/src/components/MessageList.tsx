import { For, Show, createEffect, on } from 'solid-js'
import type { ChatMessage } from '../types'
import { formatTime, initials } from '../lib/utils'
import FileCard from './FileCard'

export default function MessageList(props: {
  messages: ChatMessage[]
  selfId: string
  onDownload: (cid: string, name: string, size: number, onProgress: (r: number) => void) => Promise<void>
}) {
  let scrollEl: HTMLDivElement | undefined

  // Auto-scroll to bottom when messages change.
  createEffect(
    on(
      () => props.messages.length,
      () => {
        queueMicrotask(() => {
          if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
        })
      },
      { defer: false },
    ),
  )

  const isSelf = (m: ChatMessage) => m.self || m.peerId === props.selfId

  // Whether to show the avatar+name header for this message (start of a group).
  const showHeader = (i: number) => {
    const m = props.messages[i]
    if (m.kind === 'system') return false
    const prev = props.messages[i - 1]
    if (!prev || prev.kind === 'system') return true
    return prev.peerId !== m.peerId
  }

  return (
    <div ref={scrollEl} class="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
      <div class="mx-auto flex max-w-3xl flex-col gap-1">
        <For each={props.messages}>
          {(m, i) => (
            <Show
              when={m.kind !== 'system'}
              fallback={
                <div class="my-2 flex justify-center">
                  <span class="rounded-full bg-zinc-800/70 px-3 py-1 text-[11px] text-zinc-400">
                    {m.name} {m.text}
                  </span>
                </div>
              }
            >
              <Row m={m} self={isSelf(m)} showHeader={showHeader(i())} onDownload={props.onDownload} />
            </Show>
          )}
        </For>

        <Show when={props.messages.length === 0}>
          <div class="mt-10 text-center text-sm text-zinc-600">
            No messages yet. Say hello 👋
          </div>
        </Show>
      </div>
    </div>
  )
}

function Row(props: {
  m: ChatMessage
  self: boolean
  showHeader: boolean
  onDownload: (cid: string, name: string, size: number, onProgress: (r: number) => void) => Promise<void>
}) {
  return (
    <div
      class="flex animate-fade-in-up items-end gap-2"
      classList={{ 'flex-row-reverse': props.self }}
    >
      <div class="w-8 shrink-0">
        <Show when={props.showHeader}>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-zinc-950"
            style={{ background: props.m.color }}
          >
            {initials(props.m.name)}
          </div>
        </Show>
      </div>
      <div class={`flex max-w-[78%] flex-col ${props.self ? 'items-end' : 'items-start'}`}>
        <Show when={props.showHeader}>
          <div class="mb-0.5 flex items-center gap-2 px-1">
            <span class="text-xs font-medium text-zinc-300">{props.self ? 'You' : props.m.name}</span>
            <span class="text-[10px] text-zinc-600">{formatTime(props.m.time)}</span>
          </div>
        </Show>
        <Show
          when={props.m.kind === 'file' && props.m.file}
          fallback={
            <div
              class="whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
              classList={
                props.self
                  ? 'rounded-br-sm bg-emerald-500 text-zinc-950'
                  : 'rounded-bl-sm bg-zinc-800 text-zinc-100'
              }
            >
              {props.m.text}
            </div>
          }
        >
          <div class="w-64 max-w-[80vw] sm:w-72">
            <FileCard file={props.m.file!} onDownload={props.onDownload} />
          </div>
        </Show>
      </div>
    </div>
  )
}
