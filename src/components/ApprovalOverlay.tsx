import { Show } from 'solid-js'
import { approvalState } from '../store'

/** Full-screen overlay shown to joiners until the creator approves/denies. */
export default function ApprovalOverlay(props: { room: string }) {
  return (
    <Show when={approvalState() !== 'approved'}>
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-zinc-50/95 p-6">
        <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl">
          <Show
            when={approvalState() === 'denied'}
            fallback={
              <>
                <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6 animate-spin-slow">
                    <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
                  </svg>
                </div>
                <h2 class="text-base font-semibold text-zinc-900">Waiting for approval</h2>
                <p class="mt-1.5 text-sm text-zinc-500">
                  The room creator needs to approve your join request. This appears automatically once they're online.
                </p>
                <p class="mt-3 font-mono text-xs text-zinc-400">room / {props.room}</p>
              </>
            }
          >
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              </svg>
            </div>
            <h2 class="text-base font-semibold text-zinc-900">Join request denied</h2>
            <p class="mt-1.5 text-sm text-zinc-500">The creator denied your request. Returning home…</p>
          </Show>
        </div>
      </div>
    </Show>
  )
}
