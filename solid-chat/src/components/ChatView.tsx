import { For, Show } from 'solid-js'
import type { Profile, ChatMessage, ReceivedFile } from '../types'
import {
  messages, localStream, remoteStreams, peers, callState,
  micEnabled, camEnabled,
} from '../store'
import { formatTime, shortCid, formatBytes, fileEmoji, gatewayUrl } from '../lib/utils'
import MessageInput from './MessageInput'
import VideoTile from './VideoTile'

export default function ChatView(props: {
  profile: Profile
  onStartAudio: () => void
  onStartVideo: () => void
  onEndCall: () => void
  onToggleMic: () => void
  onToggleCam: () => void
  onSendText: (t: string) => void
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  const hasRemote = () => Object.keys(remoteStreams()).length > 0
  const inCall = () => callState() !== 'idle'
  const showTiles = () => inCall() || hasRemote()

  const peerFor = (id: string) => peers()[id]

  const isSelf = (m: ChatMessage) => m.self || m.peerId === 'system' && m.self

  const showHeader = (i: number) => {
    const m = messages()[i]
    if (m.kind === 'system') return false
    const prev = messages()[i - 1]
    if (!prev || prev.kind === 'system') return true
    return prev.peerId !== m.peerId
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-zinc-50">
      {/* Call tiles */}
      <Show when={showTiles()}>
        <div class="border-b border-zinc-200 bg-white">
          <div class="flex gap-2 overflow-x-auto p-3">
            <Show when={inCall() && localStream()}>
              <VideoTile
                stream={localStream()!}
                muted
                label="You"
                color={props.profile.color}
                video={callState() === 'video' && camEnabled()}
                camOff={!camEnabled() && callState() === 'video'}
              />
            </Show>
            <For each={Object.entries(remoteStreams())}>
              {([id, stream]) => {
                const p = peerFor(id)
                const hasVideo =
                  stream.getVideoTracks().filter((t) => t.enabled && t.readyState === 'live').length > 0
                return (
                  <VideoTile
                    stream={stream}
                    label={p?.name ?? 'Peer'}
                    color={p?.color ?? '#a1a1aa'}
                    video={hasVideo}
                  />
                )
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Call controls bar (always visible) */}
      <div class="flex items-center justify-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <Show
          when={inCall()}
          fallback={
            <>
              <span class="mr-1 text-xs text-zinc-400">
                {hasRemote() ? 'Peer is live · join with' : 'Start a call'}
              </span>
              <CtrlBtn kind="ghost" onClick={props.onStartAudio} title="Start audio call">
                🎙️ Audio
              </CtrlBtn>
              <CtrlBtn kind="ghost" onClick={props.onStartVideo} title="Start video call">
                📹 Video
              </CtrlBtn>
            </>
          }
        >
          <CtrlBtn kind="toggle" active={micEnabled()} onClick={props.onToggleMic} title={micEnabled() ? 'Mute' : 'Unmute'}>
            {micEnabled() ? '🎙️' : '🔇'}
          </CtrlBtn>
          <Show when={callState() === 'video'}>
            <CtrlBtn kind="toggle" active={camEnabled()} onClick={props.onToggleCam} title={camEnabled() ? 'Stop video' : 'Start video'}>
              {camEnabled() ? '📹' : '🚫'}
            </CtrlBtn>
          </Show>
          <CtrlBtn kind="danger" onClick={props.onEndCall} title="End call">
            <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                transform="rotate(135 12 12)"
              />
            </svg>
            End
          </CtrlBtn>
        </Show>
      </div>

      {/* Messages */}
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div class="mx-auto flex max-w-2xl flex-col gap-1">
          <For each={messages()}>
            {(m, i) => (
              <Show
                when={m.kind !== 'system'}
                fallback={
                  <div class="my-2 flex justify-center">
                    <span class="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-400">
                      {m.name} {m.text}
                    </span>
                  </div>
                }
              >
                <Row
                  m={m}
                  self={isSelf(m)}
                  showHeader={showHeader(i())}
                  onDownload={props.onDownload}
                />
              </Show>
            )}
          </For>
          <Show when={messages().length === 0}>
            <div class="mt-10 text-center text-sm text-zinc-400">
              No messages yet. Say hello 👋
            </div>
          </Show>
        </div>
      </div>

      {/* Input */}
      <MessageInput onSend={props.onSendText} />
    </div>
  )
}

function Row(props: {
  m: ChatMessage
  self: boolean
  showHeader: boolean
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  return (
    <div class="flex animate-fade-in-up items-end gap-2" classList={{ 'flex-row-reverse': props.self }}>
      <div class="w-7 shrink-0">
        <Show when={props.showHeader}>
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: props.m.color }}
          >
            {props.m.name.slice(0, 2).toUpperCase()}
          </span>
        </Show>
      </div>
      <div class={`flex max-w-[80%] flex-col ${props.self ? 'items-end' : 'items-start'}`}>
        <Show when={props.showHeader}>
          <div class="mb-0.5 flex items-center gap-1.5 px-1">
            <span class="text-xs font-medium text-zinc-700">{props.self ? 'You' : props.m.name}</span>
            <span class="text-[10px] text-zinc-400">{formatTime(props.m.time)}</span>
          </div>
        </Show>
        <Show
          when={props.m.kind === 'file' && props.m.file}
          fallback={
            <div
              class="whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed"
              classList={{
                'rounded-br-md bg-zinc-900 text-white': props.self,
                'rounded-bl-md border border-zinc-200 bg-white text-zinc-800': !props.self,
              }}
            >
              {props.m.text}
            </div>
          }
        >
          <FileBubble file={props.m.file!} self={props.self} onDownload={props.onDownload} from={props.m.name} />
        </Show>
      </div>
    </div>
  )
}

function FileBubble(props: {
  file: { cid: string; name: string; size: number; mime: string }
  self: boolean
  from: string
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  return (
    <div
      class="w-60 max-w-[80vw] rounded-2xl border p-2.5 sm:w-64"
      classList={{
        'rounded-br-md border-zinc-800 bg-zinc-900 text-white': props.self,
        'rounded-bl-md border-zinc-200 bg-white text-zinc-800': !props.self,
      }}
    >
      <div class="flex items-center gap-2.5">
        <span class="text-xl">{fileEmoji(props.file.mime)}</span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">{props.file.name}</div>
          <div class={props.self ? 'text-[11px] text-zinc-400' : 'text-[11px] text-zinc-400'}>
            {formatBytes(props.file.size)}
          </div>
        </div>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 border-t border-current/10 pt-2">
        <span class={`font-mono text-[10px] ${props.self ? 'text-zinc-400' : 'text-zinc-400'}`}>
          {shortCid(props.file.cid)}
        </span>
        <div class="flex items-center gap-2">
          <a
            href={gatewayUrl(props.file.cid)}
            target="_blank"
            rel="noreferrer"
            class={`text-[10px] underline-offset-2 hover:underline ${props.self ? 'text-zinc-300' : 'text-zinc-500'}`}
          >
            gateway ↗
          </a>
          <button
            type="button"
            onClick={() => props.onDownload(props.file.cid, props.file.name, props.file.size, props.from)}
            class="rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-900 transition hover:bg-zinc-100 active:scale-95"
            classList={{ 'bg-white text-zinc-900': props.self }}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

// keep ReceivedFile type import referenced (used implicitly via store)
export type { ReceivedFile }

function CtrlBtn(props: {
  kind: 'ghost' | 'toggle' | 'danger'
  active?: boolean
  onClick: () => void
  title?: string
  children: any
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-95'
  const styles = () => {
    if (props.kind === 'danger') return 'bg-rose-500 text-white hover:bg-rose-600'
    if (props.kind === 'toggle')
      return props.active ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
    return 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
  }
  return (
    <button type="button" onClick={props.onClick} title={props.title} class={`${base} ${styles()}`}>
      {props.children}
    </button>
  )
}
