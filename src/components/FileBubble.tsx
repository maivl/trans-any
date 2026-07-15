import { formatBytes, shortCid, gatewayUrl, fileEmoji } from '../lib/utils'
import type { FileMeta } from '../types'

/** A file message bubble shown in the chat (with Download + gateway link). */
export default function FileBubble(props: {
  file: FileMeta
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
          <div class="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{props.file.name}</div>
          <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span class="font-medium">{formatBytes(props.file.size)}</span>
            <span>·</span>
            <span class="truncate">{props.file.mime || 'file'}</span>
          </div>
        </div>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 border-t border-current/10 pt-2">
        <span class="font-mono text-[10px] text-zinc-400">{shortCid(props.file.cid)}</span>
        <div class="flex items-center gap-2">
          <a
            href={gatewayUrl(props.file.cid)}
            target="_blank"
            rel="noreferrer"
            class="text-[10px] underline-offset-2 hover:underline text-zinc-300"
          >
            gateway ↗
          </a>
          <button
            type="button"
            onClick={() => props.onDownload(props.file.cid, props.file.name, props.file.size, props.from)}
            class="rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-900 transition hover:bg-zinc-100 active:scale-95"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )
}
