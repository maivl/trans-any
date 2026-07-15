/** Small call-control button with three visual kinds. */
export default function CtrlBtn(props: {
  kind: 'ghost' | 'toggle' | 'danger'
  active?: boolean
  onClick: () => void
  title?: string
  children: any
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-95'
  const styles = () => {
    if (props.kind === 'danger') return 'bg-rose-500 text-white hover:bg-rose-600'
    if (props.kind === 'toggle')
      return props.active ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
    return 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
  }
  return (
    <button type="button" onClick={props.onClick} title={props.title} class={`${base} ${styles()}`}>
      {props.children}
    </button>
  )
}
