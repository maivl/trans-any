import { createSignal, Show } from 'solid-js'
import type { Profile } from '../types'
import { colorFromId, randomId, randomRoomCode } from '../lib/utils'

export default function JoinScreen(props: { onJoin: (p: Profile) => void }) {
  const [name, setName] = createSignal('')
  const [room, setRoom] = createSignal('')
  const [error, setError] = createSignal('')

  const handleJoin = () => {
    const n = name().trim()
    const r = room().trim().toUpperCase()
    if (!n) {
      setError('Please enter your name')
      return
    }
    if (!r || r.length < 4) {
      setError('Room code must be at least 4 characters')
      return
    }
    setError('')
    props.onJoin({ name: n, room: r, color: colorFromId(randomId()) })
  }

  return (
    <div class="relative min-h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Aurora backdrop */}
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div class="animate-aurora absolute -left-1/4 top-0 h-[60vh] w-[60vh] rounded-full bg-emerald-500/20 blur-3xl" />
        <div class="animate-aurora absolute right-0 top-1/3 h-[50vh] w-[50vh] rounded-full bg-teal-400/10 blur-3xl [animation-delay:-6s]" />
        <div class="animate-aurora absolute bottom-0 left-1/3 h-[45vh] w-[45vh] rounded-full bg-cyan-400/10 blur-3xl [animation-delay:-12s]" />
      </div>

      <div class="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div class="w-full max-w-md">
          {/* Logo / title */}
          <div class="mb-8 text-center">
            <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20">
              <svg viewBox="0 0 24 24" fill="none" class="h-7 w-7 text-zinc-950">
                <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="19" cy="5" r="2.5" fill="currentColor" />
              </svg>
            </div>
            <h1 class="text-2xl font-semibold tracking-tight">P2P Chat</h1>
            <p class="mt-1 text-sm text-zinc-400">
              Serverless WebRTC chat — text, voice, video &amp; files over IPFS
            </p>
          </div>

          {/* Card */}
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 backdrop-blur-xl">
            <label class="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Your name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. Alice"
              maxlength={24}
              class="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />

            <label class="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Room code
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                value={room()}
                onInput={(e) => setRoom(e.currentTarget.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="ABC123"
                maxlength={12}
                class="flex-1 rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 font-mono text-sm uppercase tracking-widest outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => setRoom(randomRoomCode())}
                class="shrink-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-xs font-medium text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-400"
                title="Generate a random room code"
              >
                Generate
              </button>
            </div>

            <Show when={error()}>
              <p class="mt-3 text-sm text-rose-400">{error()}</p>
            </Show>

            <button
              type="button"
              onClick={handleJoin}
              class="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99]"
            >
              Join Room
            </button>

            <p class="mt-4 text-center text-xs text-zinc-500">
              Share the room code with someone to chat peer-to-peer.
            </p>
          </div>

          {/* Feature pills */}
          <div class="mt-6 grid grid-cols-2 gap-2 text-xs">
            {[
              ['💬', 'Realtime text'],
              ['🎙️', 'Voice calls'],
              ['📹', 'Video calls'],
              ['🪐', 'IPFS file sharing'],
            ].map(([icon, label]) => (
              <div class="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-400">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <p class="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
            Powered by <span class="text-zinc-400">Trystero</span> (WebRTC signaling via
            BitTorrent trackers) &amp; <span class="text-zinc-400">Helia</span> (in-browser
            IPFS). No server stores your data.
          </p>
        </div>
      </div>
    </div>
  )
}
