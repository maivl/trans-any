import { createSignal, Show, onMount, createEffect } from 'solid-js'
import { buildShareUrl, renderQrToCanvas, renderQrDataUrl } from '../lib/qr'
import { pushToast } from '../store'

export default function QRShareModal(props: {
  room: string
  roomName: string
  onClose: () => void
}) {
  const [copied, setCopied] = createSignal(false)
  const [dataUrl, setDataUrl] = createSignal('')
  let canvas: HTMLCanvasElement | undefined

  const shareUrl = () => buildShareUrl(props.room)

  onMount(() => {
    // Close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    // cleanup handled by Solid on dispose via the modal unmounting
  })

  // Render the QR to the canvas once it's mounted / room changes.
  createEffect(() => {
    const c = canvas
    const url = shareUrl()
    if (c) {
      renderQrToCanvas(c, url, 240).catch((e) => {
        console.error('QR render failed', e)
      })
    }
    // Also produce a downloadable PNG data URL.
    renderQrDataUrl(url, 480)
      .then(setDataUrl)
      .catch(() => {})
  })

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      pushToast('Could not copy link', 'error')
    }
  }

  const downloadQr = () => {
    if (!dataUrl()) return
    const a = document.createElement('a')
    a.href = dataUrl()
    a.download = `fybeam-room-${props.room}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const shareNative = async () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({
          title: 'Join my fybeam room',
          text: `Join room "${props.roomName}" (${props.room}) on fybeam`,
          url: shareUrl(),
        })
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink()
    }
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div class="w-full max-w-xs animate-fade-in-up rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        {/* Header */}
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold text-zinc-900">Share room</h2>
          <button
            type="button"
            onClick={props.onClose}
            class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            title="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        {/* Room name + code */}
        <div class="mb-3">
          <div class="text-sm font-medium text-zinc-900">{props.roomName}</div>
          <div class="font-mono text-xs text-zinc-400">room / {props.room}</div>
        </div>

        {/* QR */}
        <div class="flex flex-col items-center">
          <div class="rounded-xl border border-zinc-200 bg-white p-2">
            <canvas ref={canvas} class="block h-60 w-60" />
          </div>
          <p class="mt-2 text-center text-[11px] leading-relaxed text-zinc-400">
            Scan to open fybeam with this room code pre-filled
          </p>
        </div>

        {/* Actions */}
        <div class="mt-4 space-y-2">
          <button
            type="button"
            onClick={shareNative}
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.99]"
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Share link
          </button>
          <div class="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              {copied() ? '✓ Copied' : '⧉ Copy link'}
            </button>
            <button
              type="button"
              onClick={downloadQr}
              class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              ⬇ Save QR
            </button>
          </div>
        </div>

        {/* Link preview */}
        <div class="mt-3 truncate rounded-md bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px] text-zinc-400" title={shareUrl()}>
          {shareUrl()}
        </div>
      </div>
    </div>
  )
}
