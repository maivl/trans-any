import { createEffect, Show } from 'solid-js'
import { initials } from '../lib/utils'

export default function VideoTile(props: {
  stream: MediaStream
  muted?: boolean
  label: string
  color: string
  video: boolean
  camOff?: boolean
}) {
  let video: HTMLVideoElement | undefined

  createEffect(() => {
    const s = props.stream
    if (video && s) {
      video.srcObject = s
      video.play().catch(() => {})
    }
  })

  const showAvatar = () => !props.video || props.camOff

  return (
    <div class="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 sm:h-28 sm:w-40">
      <video
        ref={video}
        autoplay
        playsinline
        muted={props.muted}
        class="h-full w-full object-cover"
        classList={{ 'opacity-0': showAvatar() }}
      />
      <Show when={showAvatar()}>
        <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
          <span
            class="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: props.color }}
          >
            {initials(props.label)}
          </span>
        </div>
      </Show>
      <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
        <span class="truncate text-[11px] font-medium text-white">{props.label}</span>
        <Show when={props.muted}>
          <span class="rounded bg-black/40 px-1 text-[9px] uppercase text-zinc-200">you</span>
        </Show>
      </div>
    </div>
  )
}
