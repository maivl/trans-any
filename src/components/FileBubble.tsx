import { createSignal, Show } from 'solid-js'
import { formatBytes, shortCid, gatewayUrl, fileIconKey } from '../lib/utils'
import type { FileMeta } from '../types'
import { Icon, type IconKey } from './icons'

type ActionState = 'idle' | 'loading' | 'success' | 'error'

export default function FileBubble(props: {
  file: FileMeta
  self: boolean
  from: string
  onDownload: (cid: string, name: string, size: number, from: string) => void
  onPin: (cid: string, name: string) => void
}) {
  const [pinState, setPinState] = createSignal<ActionState>('idle')
  const [dlState, setDlState] = createSignal<ActionState>('idle')

  const handlePin = async () => {
    if (pinState() === 'loading') return
    setPinState('loading')
    try {
      await props.onPin(props.file.cid, props.file.name)
      setPinState('success')
    } catch {
      setPinState('error')
    }
    setTimeout(() => setPinState('idle'), 3000)
  }

  const handleDownload = async () => {
    if (dlState() === 'loading') return
    setDlState('loading')
    try {
      await props.onDownload(props.file.cid, props.file.name, props.file.size, props.from)
      setDlState('success')
    } catch {
      setDlState('error')
    }
    setTimeout(() => setDlState('idle'), 3000)
  }

  return (
    <div
      class="w-60 max-w-[80vw] rounded-2xl border p-2.5 sm:w-64"
      classList={{
        'rounded-br-md border-zinc-800 bg-zinc-900 text-white': props.self,
        'rounded-bl-md border-zinc-200 bg-white text-zinc-800': !props.self,
      }}
    >
      <div class="flex items-center gap-2.5">
        <span class="flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500">
          <Icon name={fileIconKey(props.file.mime) as IconKey} class="h-5 w-5" />
        </span>
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
          <ActionButton
            state={pinState()}
            onClick={handlePin}
            title="Pin to IPFS network"
            idleIcon={<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M12 17v5M9 10.76V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4.76a2 2 0 0 0 .5 1.32L18 15H6l2.5-2.92a2 2 0 0 0 .5-1.32Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}
          />
          <ActionButton
            state={dlState()}
            onClick={handleDownload}
            title="Download"
            idleIcon={<Icon name="download" class="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  )
}

function ActionButton(props: {
  state: ActionState
  onClick: () => void
  title: string
  idleIcon: any
}) {
  const colorClass = () => {
    switch (props.state) {
      case 'loading': return 'text-zinc-400'
      case 'success': return 'text-emerald-500'
      case 'error': return 'text-rose-500'
      default: return 'text-amber-400'
    }
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.title}
      class={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 ${colorClass()}`}
    >
      <Show when={props.state === 'loading'}>
        <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4 animate-spin">
          <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </Show>
      <Show when={props.state === 'success'}>
        <Icon name="check" class="h-4 w-4" />
      </Show>
      <Show when={props.state === 'error'}>
        <Icon name="warn" class="h-4 w-4" />
      </Show>
      <Show when={props.state === 'idle'}>
        {props.idleIcon}
      </Show>
    </button>
  )
}
