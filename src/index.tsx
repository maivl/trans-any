/**
 * Entry point — simplified flow (no join screen).
 *
 * • Initiator (no ?room=): generates a random room code + random name and
 *   joins immediately. Shows the share link / QR so someone can join.
 * • Receiver (?room=<code>): joins the given room with a random name.
 *
 * The whole chat UI is rendered by the <fybeam-room> Web Component (Solid
 * customElement). Props are passed as HTML attributes (component-register
 * reads them on connect); the `leave` event is wired via addEventListener.
 */
import './styles/index.css'
// Importing the component module registers <fybeam-room> as a custom element.
import './components/FybeamRoom'
import { randomRoomCode, randomRoomName, randomName, colorFromId, randomId } from './lib/utils'
import { log } from './lib/debug'

function getRoomFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('room')
    if (r && r.length >= 2) return r.toLowerCase()
  } catch {
    /* ignore */
  }
  return null
}

function main() {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root not found')

  const room = getRoomFromUrl() ?? randomRoomCode()
  const isInitiator = getRoomFromUrl() === null
  const name = randomName()
  const color = colorFromId(randomId())
  const roomName = randomRoomName()

  log.info('boot', 'starting', { room, name, isInitiator, url: location.href })

  // For the initiator, push the room code into the URL (without reload) so the
  // share link / QR is correct and the page is bookmarkable.
  if (isInitiator) {
    const url = new URL(window.location.href)
    url.searchParams.set('room', room)
    window.history.replaceState({}, '', url.toString())
    log.info('boot', 'initiator: room code added to URL', { room })
  }

  // Mount the <fybeam-room> Web Component with props as attributes.
  const el = document.createElement('fybeam-room')
  el.setAttribute('room', room)
  el.setAttribute('name', name)
  el.setAttribute('color', color)
  el.setAttribute('room-name', roomName)
  // `leave` event handler.
  el.addEventListener('leave', () => {
    log.info('boot', 'leave requested')
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.replaceState({}, '', url.toString())
    window.location.reload()
  })
  root.appendChild(el)
}

main()
