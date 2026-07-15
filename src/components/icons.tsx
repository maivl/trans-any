import type { JSX } from 'solid-js'

/** Icon keys used across the app (replaces emoji). */
export type IconKey = 'file' | 'audio' | 'video' | 'debug' | 'clear' | 'end' | 'mic-on' | 'mic-off' | 'cam-on' | 'cam-off' | 'check' | 'warn' | 'copy' | 'download' | 'upload' | 'image' | 'film' | 'music' | 'pdf' | 'archive' | 'doc' | 'send-up' | 'send-down'

/** Render an SVG icon by key. All icons use currentColor and a 24x24 viewBox. */
export function Icon(props: { name: IconKey; class?: string }): JSX.Element {
  const cls = props.class ?? 'h-4 w-4'
  const paths: Record<IconKey, JSX.Element> = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    audio: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    video: <><rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="2" /><path d="m22 8-6 4 6 4V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    debug: <><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="m9 16 2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    clear: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    end: <><path d="M21 15.462l-4.135-2.257a.5.5 0 0 0-.736.461v.633a.5.5 0 0 1-.5.5H8.5a.5.5 0 0 1-.5-.5v-.633a.5.5 0 0 0-.736-.46L3 15.46V8l4.264 2.498a.5.5 0 0 0 .736-.46V9.4a.5.5 0 0 1 .5-.5h7.2a.5.5 0 0 1 .5.5v.637a.5.5 0 0 0 .736.461L21 8v7.462Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(135 12 12)" /></>,
    'mic-on': <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    'mic-off': <><path d="M9 9v-4a3 3 0 0 1 5.12-2.12M9 9v6m0-6a3 3 0 0 0 3 3m6-3v2a7 7 0 0 1-1.5 4.36M19 10a7 7 0 0 0-7-7m0 16v3M2 2l20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    'cam-on': <><rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="2" /><path d="m22 8-6 4 6 4V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    'cam-off': <><path d="M2 2l20 20M10.66 6H14a2 2 0 0 1 2 2v3.34l4.51 2.6a.5.5 0 0 1 0 .86l-.87.5M16 16H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2m12 2v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    check: <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />,
    warn: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />,
    upload: <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" /><circle cx="9" cy="9" r="2" stroke="currentColor" stroke-width="2" /><path d="m21 15-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    film: <><rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="2" /><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></>,
    music: <><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2" /><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="2" /></>,
    pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><text x="12" y="17" text-anchor="middle" font-size="6" fill="currentColor" stroke="none">PDF</text></>,
    archive: <><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></>,
    'send-up': <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />,
    'send-down': <path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />,
  }
  return <svg viewBox="0 0 24 24" fill="none" class={cls}>{paths[props.name]}</svg>
}
