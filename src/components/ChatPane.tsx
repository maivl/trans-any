import { For, Show, createEffect, createSignal } from 'solid-js'
import type { ChatMessage, CallState } from '../types'
import { formatTime } from '../lib/utils'
import type { DebugEntry } from '../lib/debug'
import VideoTile from './VideoTile'
import FileBubble from './FileBubble'
import CtrlBtn from './CtrlBtn'
import DebugConsole from './DebugConsole'

/** Chat tab: video tiles, call controls, message list, pill-shaped input. */
export default function ChatPane(props: {
  name: string
  color: string
  messages: ChatMessage[]
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  peers: Record<string, { id: string; name: string; color: string }>
  callState: CallState
  micEnabled: boolean
  camEnabled: boolean
  onStartAudio: () => void
  onStartVideo: () => void
  onEndCall: () => void
  onToggleMic: () => void
  onToggleCam: () => void
  onSendText: (t: string) => void
  onSendFile: (f: File) => void
  onDownload: (cid: string, name: string, size: number, from: string) => void
  showDebug: boolean
  setShowDebug: (v: boolean) => void
  debugEntries: DebugEntry[]
  onClearDebug: () => void
}) {
  const [text, setText] = createSignal('')
  let textarea: HTMLTextAreaElement | undefined
  let scrollEl: HTMLDivElement | undefined
  let chatFileInput: HTMLInputElement | undefined

  const hasRemote = () => Object.keys(props.remoteStreams).length > 0
  const inCall = () => props.callState !== 'idle'
  const showTiles = () => inCall() || hasRemote()

  createEffect(() => {
    queueMicrotask(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
    })
  })

  const send = () => {
    const t = text().trim()
    if (!t) return
    props.onSendText(t)
    setText('')
    if (textarea) textarea.style.height = 'auto'
  }
  const onInput = () => {
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px'
    }
  }

  const isSelf = (m: ChatMessage) => m.self
  const showHeader = (i: number) => {
    const m = props.messages[i]
    if (m.kind === 'system') return false
    const prev = props.messages[i - 1]
    if (!prev || prev.kind === 'system') return true
    return prev.peerId !== m.peerId
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-zinc-50">
      {/* Video tiles */}
      <Show when={showTiles()}>
        <div class="border-b border-zinc-200 bg-white">
          <div class="flex gap-2 overflow-x-auto p-3">
            <Show when={inCall() && props.localStream}>
              <VideoTile
                stream={props.localStream!}
                muted
                label="You"
                color={props.color}
                video={props.callState === 'video' && props.camEnabled}
                camOff={!props.camEnabled && props.callState === 'video'}
              />
            </Show>
            <For each={Object.entries(props.remoteStreams)}>
              {([id, stream]) => {
                const p = props.peers[id]
                const hasVideo = stream.getVideoTracks().filter((t) => t.enabled && t.readyState === 'live').length > 0
                return <VideoTile stream={stream} label={p?.name ?? 'Peer'} color={p?.color ?? '#a1a1aa'} video={hasVideo} />
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Call controls + debug toggle */}
      <div class="flex items-center justify-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <Show
          when={inCall()}
          fallback={
            <>
              <span class="mr-1 text-xs text-zinc-400">{hasRemote() ? 'Peer is live · join with' : 'Start a call'}</span>
              <CtrlBtn kind="ghost" onClick={props.onStartAudio}>🎙️ Audio</CtrlBtn>
              <CtrlBtn kind="ghost" onClick={props.onStartVideo}>📹 Video</CtrlBtn>
            </>
          }
        >
          <CtrlBtn kind="toggle" active={props.micEnabled} onClick={props.onToggleMic}>{props.micEnabled ? '🎙️' : '🔇'}</CtrlBtn>
          <Show when={props.callState === 'video'}>
            <CtrlBtn kind="toggle" active={props.camEnabled} onClick={props.onToggleCam}>{props.camEnabled ? '📹' : '🚫'}</CtrlBtn>
          </Show>
          <CtrlBtn kind="danger" onClick={props.onEndCall}>
            <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(135 12 12)" />
            </svg>
            End
          </CtrlBtn>
        </Show>
        <button type="button" onClick={() => props.setShowDebug(!props.showDebug)} class="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50">🐛 Debug</button>
      </div>

      {/* Messages */}
      <div ref={scrollEl} class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div class="mx-auto flex max-w-2xl flex-col gap-1">
          <For each={props.messages}>
            {(m, i) => (
              <Show
                when={m.kind !== 'system'}
                fallback={
                  <div class="my-2 flex justify-center">
                    <span class="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-400">{m.name} {m.text}</span>
                  </div>
                }
              >
                <div class="flex animate-fade-in-up items-end gap-2" classList={{ 'flex-row-reverse': isSelf(m) }}>
                  <div class="w-7 shrink-0">
                    <Show when={showHeader(i())}>
                      <span class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{m.name.slice(0, 2).toUpperCase()}</span>
                    </Show>
                  </div>
                  <div class={`flex min-w-0 max-w-[80%] flex-col ${isSelf(m) ? 'items-end' : 'items-start'}`}>
                    <Show when={showHeader(i())}>
                      <div class="mb-0.5 flex items-center gap-1.5 px-1">
                        <span class="text-xs font-medium text-zinc-700">{isSelf(m) ? 'You' : m.name}</span>
                        <span class="text-[10px] text-zinc-400">{formatTime(m.time)}</span>
                      </div>
                    </Show>
                    <Show
                      when={m.kind === 'file' && m.file}
                      fallback={
                        <div
                          class="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]"
                          classList={{ 'rounded-br-md bg-zinc-900 text-white': isSelf(m), 'rounded-bl-md border border-zinc-200 bg-white text-zinc-800': !isSelf(m) }}
                        >
                          {m.text}
                        </div>
                      }
                    >
                      <FileBubble file={m.file!} self={isSelf(m)} onDownload={props.onDownload} from={m.name} />
                    </Show>
                  </div>
                </div>
              </Show>
            )}
          </For>
          <Show when={props.messages.length === 0}>
            <div class="mt-10 text-center text-sm text-zinc-400">No messages yet. Say hello 👋</div>
          </Show>
        </div>
      </div>

      {/* Input — pill-shaped bar */}
      <div class="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div class="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1.5 transition focus-within:border-zinc-400 focus-within:bg-white">
          <input
            ref={chatFileInput}
            type="file"
            class="hidden"
            multiple
            onChange={(e) => {
              const fs = (e.currentTarget as HTMLInputElement).files
              if (fs) for (const f of Array.from(fs)) props.onSendFile(f)
              if (chatFileInput) chatFileInput.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => chatFileInput?.click()}
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
            title="Attach file"
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
          <textarea
            ref={textarea}
            value={text()}
            rows={1}
            placeholder="Message…"
            onInput={(e) => {
              setText(e.currentTarget.value)
              onInput()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            class="min-h-8 max-h-[120px] w-full flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-5 outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text().trim()}
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            title="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </div>

      <Show when={props.showDebug}>
        <DebugConsole entries={props.debugEntries} onClose={() => props.setShowDebug(false)} onClear={props.onClearDebug} />
      </Show>
    </div>
  )
}
