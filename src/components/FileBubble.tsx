import { formatBytes, shortCid, gatewayUrl, fileIconKey } from '../lib/utils'
import type { FileMeta } from '../types'
import { Icon, type IconKey } from './icons'

/** A file message bubble shown in the chat (with Download + gateway link). */
export default function FileBubble(props: {
  file: FileMeta
  self: boolean
  from: string
  onDownload: (cid: string, name: string, size: number, from: string) => void
  onPin: (cid: string, name: string) => void
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
        <span class="flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500"><Icon name={fileIconKey(props.file.mime) as IconKey} class="h-5 w-5" /></span>
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
            onClick={() => props.onPin(props.file.cid, props.file.name)}
            class="flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 active:scale-95"
            title="Pin to IPFS network"
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-3 w-3">
              <path d="M12 17v5M9 10.76V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4.76a2 2 0 0 0 .5 1.32L18 15H6l2.5-2.92a2 2 0 0 0 .5-1.32Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Pin
          </button>
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
