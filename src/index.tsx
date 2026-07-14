/**
 * Entry point — path-based routing.
 *
 * • `/`            → create a new room: generate random room code, redirect to
 *                    `/room/<code>` (the creator flow).
 * • `/room/<code>` → creator (host) of the room. Generates a random name,
 *                    joins, shows the share link + QR, and can approve/deny
 *                    join requests.
 * • `/room/join/<code>` → joiner. Generates a random name, requests to join,
 *                    waits for creator approval, then enters the room.
 *                    (No QR is shown for joiners.)
 *
 * The whole chat UI is rendered by the <fybeam-room> Web Component (Solid
 * customElement). Props are passed as HTML attributes; events via listeners.
 */
import './styles/index.css'
// Importing the component module registers <fybeam-room> as a custom element.
import './components/FybeamRoom'
import { randomRoomCode, randomRoomName, randomName, colorFromId, randomId } from './lib/utils'
import { log } from './lib/debug'

type Role = 'creator' | 'joiner'

function parseRoute(): { role: Role; room: string } | null {
  const path = window.location.pathname.replace(/\/+$/, '') // trim trailing /
  // /room/join/<code>
  const joinMatch = path.match(/^\/room\/join\/([a-z0-9]+)$/i)
  if (joinMatch) return { role: 'joiner', room: joinMatch[1].toLowerCase() }
  // /room/<code>
  const createMatch = path.match(/^\/room\/([a-z0-9]+)$/i)
  if (createMatch) return { role: 'creator', room: createMatch[1].toLowerCase() }
  return null
}

function main() {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root not found')

  let route = parseRoute()

  // `/` (or any unmatched path) → create a new room and redirect to /room/<code>
  if (!route) {
    const room = randomRoomCode()
    log.info('boot', 'creating new room, redirecting', { room })
    window.history.replaceState({}, '', `/room/${room}`)
    route = { role: 'creator', room }
  }

  const { role, room } = route
  const name = randomName()
  const color = colorFromId(randomId())
  const roomName = randomRoomName()
  const isCreator = role === 'creator'

  log.info('boot', 'starting', { room, name, role, url: location.href })

  // Mount the <fybeam-room> Web Component with props as attributes.
  const el = document.createElement('fybeam-room')
  el.setAttribute('room', room)
  el.setAttribute('name', name)
  el.setAttribute('color', color)
  el.setAttribute('room-name', roomName)
  el.setAttribute('role', role) // 'creator' | 'joiner'
  // `leave` event handler — return to home (which creates a new room).
  el.addEventListener('leave', () => {
    log.info('boot', 'leave requested')
    window.location.href = '/'
  })
  root.appendChild(el)
}

main()
