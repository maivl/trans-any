import { For, Show, createSignal } from 'solid-js'
import type { ReceivedFile } from '../types'
import { received, ipfsStatus, peers } from '../store'
import { formatBytes, formatTime, fileEmoji, shortCid, gatewayUrl } from '../lib/utils'

export default function FilesView(props: {
  onSendFile: (f: File) => void
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  const [dragging, setDragging] = createSignal(false)
  let fileInput: HTMLInputElement | undefined

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer?.files
    if (files) for (const f of Array.from(files)) props.onSendFile(f)
  }

  const onPick = () => fileInput?.click()
  const onChange = (e: Event) => {
    const files = (e.currentTarget as HTMLInputElement).files
    if (files) for (const f of Array.from(files)) props.onSendFile(f)
    if (fileInput) fileInput.value = ''
  }

  const receivedFiles = () => received().filter((f) => f.cid)
  const hasPeers = () => Object.keys(peers()).length > 0

  return (
    <div class="min-h-0 flex-1 overflow-y-auto bg-zinc-50">
      <div class="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-6 sm:px-8">
        {/* Header */}
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-zinc-900">Files</h1>
          <p class="mt-0.5 text-sm text-zinc-500">
            Send files peer-to-peer via IPFS.{' '}
            <Show when={!hasPeers()}>
              <span class="text-amber-600">Waiting for a peer to connect…</span>
            </Show>
          </p>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={onPick}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition"
          classList={{
            'border-zinc-900 bg-white': dragging(),
            'border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50': !dragging(),
          }}
        >
          <div
            class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
            classList={{ 'bg-zinc-900 text-white': dragging() }}
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6">
              <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="text-sm font-medium text-zinc-700">
            {dragging() ? 'Drop to send' : 'Drop files here or click to browse'}
          </p>
          <p class="mt-1 text-xs text-zinc-400">
            <Show when={ipfsStatus() === 'ready'} fallback="Starting IPFS node…">
              Files are published to IPFS and shared with all peers
            </Show>
          </p>
          <input ref={fileInput} type="file" class="hidden" multiple onChange={onChange} />
        </div>

        {/* Received */}
        <div>
          <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Received
          </h2>
          <Show when={receivedFiles().length === 0}>
            <div class="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-400">
              No files received yet
            </div>
          </Show>
          <div class="space-y-2">
            <For each={receivedFiles()}>
              {(f) => <ReceivedRow file={f} onDownload={props.onDownload} />}
            </For>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReceivedRow(props: {
  file: ReceivedFile
  onDownload: (cid: string, name: string, size: number, from: string) => void
}) {
  return (
    <div class="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
        {fileEmoji(props.file.mime)}
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-zinc-900">{props.file.name}</div>
        <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span>{formatBytes(props.file.size)}</span>
          <span>·</span>
          <span>from {props.file.from}</span>
          <span>·</span>
          <span>{formatTime(props.file.time)}</span>
        </div>
        <div class="mt-0.5 font-mono text-[10px] text-zinc-400">{shortCid(props.file.cid)}</div>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => props.onDownload(props.file.cid, props.file.name, props.file.size, props.file.from)}
          class="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 active:scale-95"
        >
          Download
        </button>
        <a
          href={gatewayUrl(props.file.cid)}
          target="_blank"
          rel="noreferrer"
          class="text-[10px] text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline"
        >
          gateway ↗
        </a>
      </div>
    </div>
  )
}
