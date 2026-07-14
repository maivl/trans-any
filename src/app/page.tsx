'use client'

/**
 * The user-facing route `/` hosts the Vite + SolidJS WebRTC chat app.
 *
 * The SolidJS app is built statically into `public/chat/` (see `solid-chat/`)
 * and embedded here via a same-origin iframe. Same-origin means the iframe can
 * request camera/microphone permissions directly, and all asset requests
 * resolve to `/chat/...` which Next.js serves as static files from `public/`.
 */
export default function Home() {
  return (
    <iframe
      src="/chat/index.html"
      title="P2P Chat — WebRTC · IPFS"
      allow="camera; microphone; display-capture; autoplay; fullscreen; encrypted-media"
      allowFullScreen
      className="fixed inset-0 h-full w-full border-0"
    />
  )
}
