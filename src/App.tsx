import { createSignal, Show } from 'solid-js'
import JoinScreen from './components/JoinScreen'
import RoomShell from './components/RoomShell'
import Toaster from './components/Toaster'
import type { Profile } from './types'

export default function App() {
  const [profile, setProfile] = createSignal<Profile | null>(null)

  return (
    <>
      <Show when={profile()} fallback={<JoinScreen onJoin={setProfile} />}>
        <RoomShell profile={profile()!} onLeave={() => setProfile(null)} />
      </Show>
      <Toaster />
    </>
  )
}
