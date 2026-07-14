import { createEffect, Show } from 'solid-js'
import { initials } from '../lib/utils'

export default function VideoTile(props: {
  stream: MediaStream
  muted?: boolean
  label: string
  color: string
  /** Whether the stream contains a video track. */
  video: boolean
  camOff?: boolean
  class?: string
}) {
  let video: HTMLVideoElement | undefined

  createEffect(() => {
    const s = props.stream
    if (video && s) {
      video.srcObject = s
      // Ensure playback starts (some browsers need an explicit play()).
      video.play().catch(() => {})
    }
  })

  const showAvatar = () => !props.video || props.camOff

  return (
    <div
      class={`relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 ${props.class ?? ''}`}
    >
      <video
        ref={video}
        autoplay
        playsinline
        muted={props.muted}
        class="h-full w-full object-cover"
        classList={{ 'opacity-0': showAvatar() }}
      />
      <Show when={showAvatar()}>
        <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-zinc-950"
            style={{ background: props.color }}
          >
            {initials(props.label)}
          </div>
        </div>
      </Show>
      <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span class="truncate text-[11px] font-medium text-white">{props.label}</span>
        <Show when={props.muted}>
          <span class="rounded bg-black/40 px-1 text-[9px] uppercase text-zinc-300">you</span>
        </Show>
      </div>
    </div>
  )
}
