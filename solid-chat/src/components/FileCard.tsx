import { createSignal, Show } from 'solid-js'
import type { FileMeta } from '../types'
import { formatBytes, shortCid, gatewayUrl } from '../lib/utils'

export default function FileCard(props: {
  file: FileMeta
  onDownload: (cid: string, name: string, size: number, onProgress: (r: number) => void) => Promise<void>
}) {
  const [downloading, setDownloading] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [copied, setCopied] = createSignal(false)
  const [error, setError] = createSignal('')

  const isImage = () => props.file.mime.startsWith('image/')

  const download = async () => {
    if (downloading()) return
    setDownloading(true)
    setProgress(0)
    setError('')
    try {
      await props.onDownload(props.file.cid, props.file.name, props.file.size, (r) => setProgress(r))
    } catch (e) {
      console.error(e)
      setError('Could not fetch from IPFS')
    } finally {
      setDownloading(false)
    }
  }

  const copyCid = async () => {
    try {
      await navigator.clipboard.writeText(props.file.cid)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div class="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800/80">
      <div class="flex items-center gap-3 p-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-lg">
          {isImage() ? '🖼️' : '📄'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-zinc-100">{props.file.name}</div>
          <div class="text-[11px] text-zinc-400">{formatBytes(props.file.size)}</div>
        </div>
      </div>

      {/* CID row */}
      <div class="flex items-center justify-between gap-2 border-t border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5">
        <button
          type="button"
          onClick={copyCid}
          class="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400 transition hover:text-emerald-400"
          title="Copy CID"
        >
          <span class="text-zinc-600">CID</span>
          {shortCid(props.file.cid)}
          <span class="text-zinc-600">{copied() ? '✓' : '⧉'}</span>
        </button>
        <a
          href={gatewayUrl(props.file.cid)}
          target="_blank"
          rel="noreferrer"
          class="text-[11px] text-zinc-500 underline-offset-2 transition hover:text-emerald-400 hover:underline"
          title="Open on public IPFS gateway"
        >
          gateway ↗
        </a>
      </div>

      {/* Action / progress */}
      <div class="border-t border-zinc-700/60 px-3 py-2">
        <Show
          when={!downloading()}
          fallback={
            <div class="flex items-center gap-2">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-700">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(progress() * 100)}%` }}
                />
              </div>
              <span class="text-[11px] text-zinc-400">{Math.round(progress() * 100)}%</span>
            </div>
          }
        >
          <div class="flex items-center justify-between gap-2">
            <Show when={error()} fallback={
              <span class="text-[11px] text-zinc-500">Fetch via IPFS</span>
            }>
              <span class="text-[11px] text-rose-400">{error()}</span>
            </Show>
            <button
              type="button"
              onClick={download}
              class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" class="h-3.5 w-3.5">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Download
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
