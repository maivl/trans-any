import { For, Show } from 'solid-js'
import type { CallState, PeerInfo } from '../types'
import VideoTile from './VideoTile'

export default function CallBar(props: {
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  peers: Record<string, PeerInfo>
  callState: CallState
  micEnabled: boolean
  camEnabled: boolean
  selfName: string
  selfColor: string
  onStartAudio: () => void
  onStartVideo: () => void
  onEnd: () => void
  onToggleMic: () => void
  onToggleCam: () => void
}) {
  const hasRemote = () => Object.keys(props.remoteStreams).length > 0
  const active = () => props.callState !== 'idle' || hasRemote()
  const remoteEntries = () => Object.entries(props.remoteStreams)

  const localHasVideo = () => props.callState === 'video' && props.camEnabled

  const peerFor = (id: string): PeerInfo | undefined => props.peers[id]

  return (
    <div class="border-b border-zinc-800 bg-zinc-900/50">
      {/* Tiles (only when there is something to show) */}
      <Show when={active()}>
        <div class="flex gap-2 overflow-x-auto p-2.5">
          <Show when={props.callState !== 'idle' && props.localStream}>
            <VideoTile
              stream={props.localStream!}
              muted
              label={`${props.selfName} (you)`}
              color={props.selfColor}
              video={localHasVideo()}
              camOff={!props.camEnabled && props.callState === 'video'}
              class="h-24 w-32 shrink-0 sm:h-28 sm:w-40"
            />
          </Show>
          <For each={remoteEntries()}>
            {([id, stream]) => {
              const p = peerFor(id)
              const hasVideo = stream.getVideoTracks().filter((t) => t.enabled && t.readyState === 'live').length > 0
              return (
                <VideoTile
                  stream={stream}
                  label={p?.name ?? 'Peer'}
                  color={p?.color ?? '#52525b'}
                  video={hasVideo}
                  class="h-24 w-32 shrink-0 sm:h-28 sm:w-40"
                />
              )
            }}
          </For>
        </div>
      </Show>

      {/* Controls (always visible) */}
      <div class="flex items-center justify-center gap-2 px-3 py-2.5">
        <Show
          when={props.callState !== 'idle'}
          fallback={
            <>
              <span class="mr-1 text-xs text-zinc-500">
                {hasRemote() ? "You're listening · join with" : 'Start a call'}
              </span>
              <CallButton kind="ghost" onClick={props.onStartAudio} title="Start audio call">
                🎙️ Audio
              </CallButton>
              <CallButton kind="ghost" onClick={props.onStartVideo} title="Start video call">
                📹 Video
              </CallButton>
            </>
          }
        >
          <CallButton
            kind="toggle"
            active={props.micEnabled}
            onClick={props.onToggleMic}
            title={props.micEnabled ? 'Mute' : 'Unmute'}
          >
            {props.micEnabled ? '🎙️' : '🔇'}
          </CallButton>
          <Show when={props.callState === 'video'}>
            <CallButton
              kind="toggle"
              active={props.camEnabled}
              onClick={props.onToggleCam}
              title={props.camEnabled ? 'Stop video' : 'Start video'}
            >
              {props.camEnabled ? '📹' : '🚫'}
            </CallButton>
          </Show>
          <CallButton kind="danger" onClick={props.onEnd} title="End call">
            <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4">
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                transform="rotate(135 12 12)"
              />
            </svg>
          </CallButton>
        </Show>
      </div>
    </div>
  )
}

function CallButton(props: {
  kind: 'ghost' | 'toggle' | 'danger'
  active?: boolean
  onClick: () => void
  title?: string
  children: any
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-95'
  const styles = () => {
    if (props.kind === 'danger')
      return 'bg-rose-500 text-white hover:bg-rose-400'
    if (props.kind === 'toggle')
      return props.active
        ? 'bg-zinc-700 text-white hover:bg-zinc-600'
        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
    return 'border border-zinc-700 bg-zinc-800/70 text-zinc-200 hover:border-emerald-500 hover:text-emerald-400'
  }
  return (
    <button type="button" onClick={props.onClick} title={props.title} class={`${base} ${styles()}`}>
      {props.children}
    </button>
  )
}
