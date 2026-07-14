import { createSignal, Show } from 'solid-js'
import type { Profile } from '../types'
import { colorFromId, randomId, randomRoomCode, randomRoomName } from '../lib/utils'

export default function JoinScreen(props: { onJoin: (p: Profile) => void }) {
  const [name, setName] = createSignal('')
  const [room, setRoom] = createSignal('')
  const [error, setError] = createSignal('')

  const handleJoin = () => {
    const n = name().trim()
    const r = room().trim().toLowerCase()
    if (!n) {
      setError('Please enter your name')
      return
    }
    if (!r || r.length < 4) {
      setError('Room code must be at least 4 characters')
      return
    }
    setError('')
    props.onJoin({
      name: n,
      room: r,
      color: colorFromId(randomId()),
      roomName: randomRoomName(),
    })
  }

  return (
    <div class="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-900">
      <div class="w-full max-w-sm">
        {/* Brand */}
        <div class="mb-8 text-center">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6">
              <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="19" cy="5" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <h1 class="text-xl font-semibold tracking-tight">fybeam</h1>
          <p class="mt-1 text-sm text-zinc-500">
            Peer-to-peer file sharing &amp; chat over WebRTC + IPFS
          </p>
        </div>

        {/* Card */}
        <div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Your name
          </label>
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. Alex"
            maxlength={24}
            class="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />

          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Room code
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              value={room()}
              onInput={(e) => setRoom(e.currentTarget.value.toLowerCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="abc123"
              maxlength={12}
              class="flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 font-mono text-sm lowercase tracking-widest outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
            <button
              type="button"
              onClick={() => setRoom(randomRoomCode())}
              class="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
              title="Generate a random room code"
            >
              Generate
            </button>
          </div>

          <Show when={error()}>
            <p class="mt-3 text-sm text-rose-600">{error()}</p>
          </Show>

          <button
            type="button"
            onClick={handleJoin}
            class="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.99]"
          >
            Join Room
          </button>

          <p class="mt-4 text-center text-xs text-zinc-400">
            Share the room code with someone to connect peer-to-peer.
          </p>
        </div>

        <p class="mt-6 text-center text-[11px] leading-relaxed text-zinc-400">
          Powered by <span class="text-zinc-500">Trystero</span> (WebRTC) &amp;{' '}
          <span class="text-zinc-500">Helia</span> (in-browser IPFS). No server stores your data.
        </p>
      </div>
    </div>
  )
}
