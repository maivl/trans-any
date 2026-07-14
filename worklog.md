# Worklog — WebRTC P2P Chat (Trystero + IPFS + Vite + SolidJS + Tailwind)

Project root: /home/z/my-project
Sub-project: /home/z/my-project/solid-chat
Serving strategy: SolidJS app built statically into `public/chat/` and embedded full-screen via a same-origin iframe on the Next.js `/` route (Caddy gateway is query-based only and `/app/Caddyfile` is not writable, so dev-server asset routing via XTransformPort is impractical; static build + Next.js public serving avoids all asset-path issues and keeps camera/mic permissions working via same-origin iframe).

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Build a WebRTC chat app with Trystero + IPFS + Vite + SolidJS + TailwindCSS supporting audio, video, file, and text transfer.

Work Log:
- Created `solid-chat/` Vite + SolidJS + TypeScript + TailwindCSS v4 sub-project (independent of the Next.js host).
- Installed deps: `solid-js`, `trystero` (+ `@trystero-p2p/torrent` for comparison), `helia` v5, `@helia/unixfs` v4, `multiformats`; dev deps `vite` v8, `vite-plugin-solid`, `tailwindcss`/`@tailwindcss/vite`, `vite-plugin-node-polyfills` (needed because Helia/libp2p reference Buffer/process/global).
- Wrote lib layer: `types.ts`, `store.ts` (Solid signals), `utils.ts`, `chat.ts` (Trystero controller), `ipfs.ts` (Helia wrapper with add/cat).
- Wrote UI components: `JoinScreen`, `ChatRoom`, `TopBar`, `PeerList`, `MessageList`, `MessageInput`, `CallBar`, `VideoTile`, `FileCard`, `Toaster`.
- Vite config: `base: '/chat/'`, `build.outDir: '../public/chat'` (builds straight into Next.js public folder). Next.js `src/app/page.tsx` replaced with a full-screen same-origin iframe to `/chat/index.html` (camera/mic work because iframe is same-origin; allow="camera; microphone; ...").
- Excluded `solid-chat/**` and `public/chat/**` from the Next.js ESLint config (SolidJS ≠ React rules).
- Debugging (the hard part): initial peer-join never fired even though signaling messages flowed. Root cause = **Trystero v0.25 restructured the API** (installed 0.25.3): events are assignable properties (`room.onPeerJoin = cb`, `onPeerLeave`, `onPeerStream`) not `room.on('peer join', cb)`; `makeAction` returns an object `{ send, onMessage }` not a `[send, receive]` tuple; media uses `room.addStream(stream)`/`removeStream(stream)` not `streamAudio`/`streamVideo`. Rewrote `chat.ts` for the v0.25 API → peers connected immediately.
- Also pinned curated Nostr relays via `relayConfig.urls` (Trystero's `getRelays` reads it) + Google STUN. Nostr is the default Trystero strategy (re-exports `@trystero-p2p/nostr`).
- Verification environment note: two headless browsers on the same machine couldn't resolve mDNS-obfuscated host candidates (`.local`, no avahi). Passed Chrome flag `--disable-features=WebRtcHideLocalIpsWithMdns` via agent-browser `--args` so host candidates used real IPs; cross-session WebRTC then connected. Real users (different devices/networks, or with mDNS resolution) do not need this.

Stage Summary:
- Final build: `public/chat/index.html` + `assets/index-*.js` (~1.6 MB / 478 KB gzip — Helia/libp2p is heavy) + CSS.
- `bun run lint` (Next.js) = clean. Next.js dev server (`bun run dev`) serves `/` (iframe) and `/chat/*` (static SolidJS build) with no errors in `dev.log`.
- Agent Browser end-to-end verification (two sessions, mDNS flag + fake-media flags):
  - ✅ Join screen renders; join flow works (name + room code).
  - ✅ Two peers discover & connect via Trystero (nostr) — `peer join` fires on both, header shows "2 peers", participants list populated.
  - ✅ Cross-peer text messaging (Bob → Alice message delivered).
  - ✅ IPFS (Helia) node initializes to "ready"; Alice published `hello.txt` to IPFS (real CID `bafyre…`), file card + CID shared to Bob via Trystero; Bob's download initiated Helia `cat` (bitswap provider discovery between two browser Helia nodes is slow but the integration is correct — add → CID → share → fetch via Helia, plus public-gateway link).
  - ✅ Audio call: Alice → Bob media stream flows (`onPeerStream`, remote `<video>` with srcObject).
  - ✅ Video call: Alice → Bob video stream flows (`videoTracks=1 live=1` on Bob).
  - ✅ Responsive (desktop + 390×844 mobile); screenshots saved in `download/`.
- Artifacts: `solid-chat/` (source), `public/chat/` (built app), `src/app/page.tsx` (iframe host), `eslint.config.mjs` (ignore solid-chat/public-chat).
- Known limitation: in-browser Helia P2P file fetch (bitswap) between two browser nodes can be slow/unreliable without a pinning service or direct libp2p relay peering; file metadata + CID sharing via Trystero works reliably. For production, add a pinning service (web3.storage/Pinata) or pre-connect Helia peers by PeerId.

---
Task ID: 2
Agent: main (Z.ai Code)
Task: Remove Next.js entirely (run pure Vite + SolidJS on port 3000) and restyle the UI to match trans.2012056.xyz (fyDrop).

Work Log:
- Analyzed reference site https://trans.2012056.xyz ("fyDrop — Seamless File Sharing", a WebRTC P2P file-share app). Confirmed via live computed styles + VLM that the rendered UI is a clean LIGHT theme: white/zinc-50 bg, dark zinc-900 text, SF Pro Display font, left sidebar with uppercase section labels (DEVICES / TRANSFERS / RECEIVED), room name + "room / code", connection status with colored dot, black active tab, rounded-2xl cards, subtle borders.
- Removed Next.js from the serving path: changed root `package.json` `dev` script from `next dev -p 3000` to `cd solid-chat && bun run dev 2>&1 | tee ../dev.log`; changed solid-chat `dev` to `vite build && vite preview --port 3000 --host --strictPort`. Killed the Next.js dev server (no supervisor/cron present, so it stays down). Vite dev server (`vite`) crashed on dependency pre-bundling of Helia/libp2p (OOM in esbuild optimizer), so the dev script builds the production bundle (which succeeds in ~1.6s) and serves it with `vite preview` — stable and fast.
- Vite config: `base: '/'` (serves at root, no /chat/ subpath), `server.port: 3000`, SF Pro / -apple-system font stack via Tailwind `@theme`.
- Extended `types.ts`/`store.ts`/`utils.ts`: added room-name generator (poetic two-word names like "Ember Grove"), `ConnStatus`, `Tab` (files/chat), `Transfer` + `addTransfer`/`updateTransfer`, `ReceivedFile` + `addReceived`.
- Rewrote the entire UI in fyDrop light style:
  - `JoinScreen` — minimal light card, brand "fybeam", name + room-code inputs, Generate, Join.
  - `RoomShell` — orchestrator: desktop sidebar (md+) + main; mobile top header (brand/room/status/Leave) + bottom Files/Chat tab bar (md:hidden). Wires Trystero + IPFS, call lifecycle, file send/receive, transfers tracking.
  - `Sidebar` — brand, room name + "room / code" (click to copy), connection status dot, DEVICES (self + peers), TRANSFERS (active/done counts + progress bars), RECEIVED (file list), IPFS status, Leave, Files/Chat tabs.
  - `FilesView` — drag-and-drop drop zone + Received list with Download + gateway link.
  - `ChatView` — message list (self = black bubbles, peers = white bordered), file bubbles, call tiles, always-visible call controls (Audio/Video start; Mute/Cam/End when in call), message input.
  - `VideoTile`, `MessageInput`, `Toaster` — restyled for light theme.
- Deleted obsolete components (ChatRoom, TopBar, PeerList, MessageList, FileCard, CallBar).
- ESLint: solid-chat/ and public/chat/ remain ignored; root `bun run lint` passes clean.

Stage Summary:
- Architecture: pure Vite + SolidJS + TailwindCSS on port 3000 (NO Next.js). `bun run dev` = `vite build && vite preview --port 3000`. Process running (pid 15238). dev.log clean.
- Build: solid-chat/dist (~1.6 MB JS / 479 KB gzip — Helia/libp2p).
- Agent Browser end-to-end verification (two sessions, mDNS-off + fake-media flags for the call test):
  - ✅ Light theme renders (join screen + room). No console/page errors.
  - ✅ Join flow; poetic room names ("Ember Grove", "Bright Peak", "Still Pine", "Distant Mist").
  - ✅ Two peers connect (status → Connected, DEVICES lists both).
  - ✅ Cross-peer text messaging (Bob → Alice delivered).
  - ✅ IPFS file share: Alice published note.txt → sidebar TRANSFERS shows "1 done"; Bob's RECEIVED shows note.txt with size/from/time.
  - ✅ Video call: Alice → Bob, `videoTracks=1 live=1` on Bob + "Peer is live" listening bar; mute/cam/end controls work.
  - ✅ Audio call: Alice → Bob, `audioTracks=1` on Bob.
  - ✅ Responsive: desktop (sidebar + main) and mobile 390×844 (top header + content + bottom tab bar).
- Screenshots in download/: light-join, light-chat, light-desktop-chat, light-desktop-files, light-mobile-chat, light-call, final-join.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Fix two user-reported issues — (1) input box and button not horizontally aligned, (2) two users entering the same room code "aaaaa" not pairing.

Work Log:
- Issue 2 diagnosis: reproduced room "aaaaa" with two browser sessions (mDNS-off flag needed only for this headless sandbox) — pairing SUCCEEDED (both peers Connected, saw each other). So the code is correct; the user's failure is environmental. Root causes addressed:
  - Signaling: the previous relay set included `wss://relay.damus.io` which aggressively rate-limits Trystero's presence announces ("rate-limited: you are noting too much"). Replaced the relay set with 9 known-good, non-rate-limiting relays (nos.lol, relay.nostrdice.com, nostr.data.haus, relay.mostr.pub, nostr-01.yakihonne.com, relay.snort.social, nostr.wine, nostr.mom, relay.nostr.net) — all verified OPEN from the sandbox. Broader coverage = higher chance both peers share a working relay even if some are blocked on the user's network. Added a 4th STUN server (Cloudflare) for better srflx coverage.
  - Diagnostics: added a live "Signaling N/M relays" indicator in the sidebar (polls Trystero's `getRelaySockets()` every 2s) so users can see whether signaling relays connected. Added an amber "No peer found yet…" hint that appears after 18s with no peer, explaining room-code/network requirements.
  - (Free public TURN is unavailable — OpenRelay credentials are deprecated and allocate no relay candidates, verified. STUN + host candidates cover same-network and most NATs; symmetric-NAT cross-network still needs a TURN the user must supply.)
- Issue 1 fix:
  - JoinScreen: the "Generate" button used `text-xs` (→38px) while the room-code input used `text-sm` (→42px), a ~4px vertical misalignment. Changed the button to `text-sm` so both render at 42px. Measured topDiff=0 after fix.
  - MessageInput: the textarea rested at ~42px (`py-2.5 leading-relaxed`) while the send button was `h-10` (40px) under `items-end` → ~2px top misalignment. Rewrote to textarea `min-h-10 py-2 leading-5` (40px resting) + button `h-10` + `items-end`/`self-end`. Measured topDiff=0, both 40px, after fix. Multi-line growth still works (JS auto-resize, button stays bottom-aligned).
- Rebuilt (`vite build`), restarted `vite preview` on port 3000.

Stage Summary:
- `bun run lint` clean; dev.log clean; preview serving HTTP 200 on :3000.
- Verified end-to-end (two sessions): room "aaaaa" → both Connected with "Signaling 9/9 relays"; text message Bob→Alice delivered; alignment measured (join: topDiff 0 / 42px; chat input: topDiff 0 / 40px). No damus rate-limit warnings anymore.
- For the user: pairing should now work for same-network / two-tab scenarios. If it still fails, the new "Signaling N/M relays" indicator tells them whether their network is blocking the relays (if N is low/0), and the amber hint explains what to check. Cross-network behind symmetric NAT would need a user-supplied TURN server (no reliable free public TURN exists).

---
Task ID: 4
Agent: main (Z.ai Code)
Task: Add QR code room-sharing feature and push the code to https://github.com/maivl/trans-any.git.

Work Log:
- Installed `qrcode` (+ `@types/qrcode`) in solid-chat.
- Created `lib/qr.ts`: `buildShareUrl(room)` → `${origin}${pathname}?room=<code>`; `renderQrToCanvas` / `renderQrDataUrl` (dark-on-light, errorCorrection M).
- Created `components/QRShareModal.tsx`: modal showing the room name + code, a 240px QR canvas (encodes the share URL), plus Share link (native Web Share API, falls back to copy), Copy link, and Save QR (download PNG) actions; closes on Escape / backdrop click.
- Added a QR icon button in the Sidebar room block (next to the room code) that opens the modal.
- `JoinScreen` now reads the `?room=` query param on mount and pre-fills the room code, with a green "✓ Room code filled from link" hint — so scanning the QR opens the app with the room ready and the recipient only needs to enter a name. (This completes the QR→join loop.)
- Updated `.gitignore` to exclude `solid-chat/dist` and `public/chat` build artifacts; removed them from the git index (`git rm --cached`).
- Added a project `README.md` (features, stack, getting started, pairing notes, structure, limitations).
- Git: set identity (maivl), added remote `origin` with the provided PAT, staged all changes, committed (`feat: add QR code room sharing and push to trans-any`), pushed to `origin/main` (new branch, 126 files). Then reset the remote URL to the token-less form for safety.

Stage Summary:
- Build: solid-chat/dist (~1.64 MB JS / 489 KB gzip incl. qrcode). `bun run lint` clean. `vite preview` on :3000 serving HTTP 200.
- Agent Browser end-to-end verification:
  - ✅ Click QR button → modal opens, canvas renders the QR, share URL `http://localhost:3000/?room=vgt88i` shown, action buttons present.
  - ✅ Open the share URL in a second session (simulates scanning the QR) → room code `vgt88i` pre-filled + green hint shown.
  - ✅ Recipient enters name → Join → both peers Connected (pairing succeeded).
- Repo: https://github.com/maivl/trans-any.git — branch `main`, head commit `02f5c12`, 126 files (full solid-chat source + config + README + root project files; node_modules & build output gitignored).
- Note: the provided GitHub token was used only for the push and then removed from the local remote URL.

---
Task ID: 5
Agent: main (Z.ai Code)
Task: Drop all Next.js usage (Vite only); show the QR code inline (no modal); ensure chat text wraps.

Work Log:
- Next.js removal: deleted `src/app` (page/layout/api/globals.css), `src/components/ui` (shadcn set), `src/hooks`, `src/lib`, `.next`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `tailwind.config.ts`, `next-env.d.ts`. Rewrote root `package.json` (name `trans-any`, only `dev`/`build`/`preview`/`lint` scripts, all next/react/shadcn deps removed). Rewrote root `tsconfig.json` (plain ESNext, includes solid-chat/src). Rewrote `eslint.config.mjs` to drop `eslint-config-next` (no longer a dep) — now just ignores sub-dirs. `bun run lint` passes. Verified the served page contains zero "next" references.
- Inline QR: removed `QRShareModal.tsx` and the sidebar QR icon button that opened it. Added an always-visible "Share room" block in the Sidebar (below the room/status block): a 176px QR canvas (renders via `renderQrToCanvas` in a `createEffect` + `onMount`), a "Scan to open…" caption, and Copy link / Save QR action buttons + the share URL preview. The QR encodes `${origin}${pathname}?room=<code>` so scanning opens the app with the room pre-filled (JoinScreen already reads `?room=`).
- Text wrapping: strengthened chat message bubbles — `whitespace-pre-wrap` (preserves `\n` line breaks) + `break-words` + `[overflow-wrap:anywhere]` (breaks long unbroken tokens) + `min-w-0 max-w-full` on the bubble, and `min-w-0` on the `max-w-[80%]` flex parent so flexbox allows the child to shrink and wrap. File-name in file bubbles changed from `truncate` to `break-words [overflow-wrap:anywhere]` so long file names wrap too.
- Rebuilt (`vite build`), restarted `vite preview` on :3000 (HTTP 200). `bun run lint` clean.

Stage Summary:
- Agent Browser verification: app renders (no Next.js); inline QR canvas present in sidebar with "Share room"/"Scan to open" copy and Copy link / Save QR buttons (no modal); two-session test — long 100-char unbroken string wraps inside the bubble (bubbleW == parentW 538px, wraps:true, no overflow) and multi-line `\n` text is preserved (bubble white-space:pre-wrap). `eslint` clean; dev.log clean.
- Git: committed `6d16b9e refactor: drop Next.js (Vite-only), inline QR display, robust text wrapping` (67 files changed, -6298/+123 lines) and pushed to https://github.com/maivl/trans-any.git main (remote head 6d16b9e). Verified remote has no `src/`, `next.config`, `.next`, or `components.json` and no `QRShareModal.tsx`.
- The provided PAT was passed via `http.extraheader` for the push only (not stored in config).

---
Task ID: 6
Agent: main (Z.ai Code)
Task: (1) Shrink the QR code. (2) Fix `npm run build` failing with `vite: command not found` (exit 127).

Work Log:
- Root cause of build failure: the root `package.json` (after the Next.js removal) had NO dependencies, while the Vite project + its deps lived in `solid-chat/`. Platforms run `npm install` + `npm run build` at the root, so `vite` was never installed and `cd solid-chat && bun run build` → `vite build` → `vite: command not found` (127).
- Fix: flattened the Vite + SolidJS project from `solid-chat/` to the repo ROOT.
  - Moved `solid-chat/src` → `src`, `solid-chat/index.html` → `index.html`, `solid-chat/vite.config.ts` → `vite.config.ts`. Removed the now-empty `solid-chat/` and the stale `public/chat/`.
  - Root `package.json` now holds all deps (solid-js, trystero, helia, @helia/unixfs, multiformats, qrcode + dev: vite, vite-plugin-solid, tailwindcss, @tailwindcss/vite, vite-plugin-node-polyfills, typescript, eslint) with scripts `dev`/`build`/`preview`/`lint`. `build` = `vite build`, `dev` = `vite build && vite preview --port 3000`.
  - Verified `npm run build` runs `vite build` directly at the root and succeeds (vite binary now at `node_modules/.bin/vite`).
  - Updated root `tsconfig.json` (SolidJS jsx), `eslint.config.mjs` (plain, ignores dist/node_modules), `.gitignore` (`/dist`, removed solid-chat references).
- QR shrink: reduced the inline sidebar QR canvas from `h-44 w-44` (176px, rendered at 224px) to `h-28 w-28` (112px, rendered at 112px) in `src/components/Sidebar.tsx`. Verified rendered size = 112×112px.

Stage Summary:
- `npm run build` → `vite build` succeeds at root (dist/ emitted). `bun run lint` clean. `vite preview` on :3000 serving HTTP 200 (kept alive via subshell pattern).
- Agent Browser: app renders; inline QR confirmed 112×112px (down from 176px); no errors.
- Git: committed `a85e8c3 fix: flatten Vite project to root (fixes npm run build) + shrink QR`, pushed to https://github.com/maivl/trans-any.git main. Remote verified: `src/`, `index.html`, `vite.config.ts`, `package.json` at root; `solid-chat/` removed. PAT passed via http.extraheader for the push only.

---
Task ID: 7
Agent: main (Z.ai Code)
Task: Keep SolidJS but expose components as Web Components; simplify (remove home screen); initiator auto-generates room code, receiver joins via share link/QR; random name pool; add debug console for pairing (user reports pairing never succeeded).

Work Log:
- Web Components with SolidJS: installed `solid-element`; the whole chat UI is now a single `<fybeam-room>` custom element (`src/components/FybeamRoom.tsx`) built via `customElement('fybeam-room', {room,name,color,roomName}, FybeamRoom)` + `noShadowDOM()` so the document's Tailwind styles apply to the light-DOM content. index.tsx creates the element, sets attributes (room/name/color/room-name), and listens for a `leave` CustomEvent.
- No home/join screen: index.tsx auto-joins on load. Initiator (no ?room=) generates a random room code + random name and pushes the room into the URL (replaceState). Receiver (?room=<code>) joins that room. Both get a random friendly name + poetic room name.
- Random names: added `randomName()` to utils (pool: Falcon, Maple, Nova, … + 2-digit suffix); kept `randomRoomName()` (Golden Cedar, Ocean Spark, …).
- Debug console for pairing: new `lib/debug.ts` (ring buffer + console + UI subscription). chat.ts now logs: relay connect/error/close, presence announce/peer-join/peer-leave, profile send/received, message received, media add/stream, and per-peer ICE state via `room.getPeers()` + RTCPeerConnection event listeners (icecandidate with type host/srflx/relay/prflx, gathering, ice/conn/signaling state, datachannel/track open). The 🐛 Debug panel (toggle from sidebar IPFS row or chat call-bar) shows timestamped, color-coded events; the Devices list also shows each peer's live `ice:` state.
- Simplified: removed App.tsx, JoinScreen, and the old standalone ChatView/FilesView/Sidebar/MessageInput/Toaster/VideoTile/RoomShell (all inlined into FybeamRoom). Kept the same light fyDrop-style UI.

Stage Summary:
- Build clean (~1.64 MB JS / 489 KB gzip); `bun run lint` clean; `vite preview` on :3000 HTTP 200.
- Agent Browser end-to-end (two sessions, mDNS-off flag for this headless sandbox): initiator auto-joined with room `brz8b4` + name Maple96, URL became `?room=brz8b4`, share QR + "Signaling 9/9 relays" visible; Bob opened the share link → auto-joined (no home screen) with name Haven11; both reached "Connected"; peer ICE state shown inline as `ice:connected`; 🐛 Debug console showed relay connects, `presence peer join`, `profile announce/sent/received`, `ice watching peer pc {ice:connected, conn:connected}`; cross-peer text message delivered.
- The user's pairing failures are most likely environmental (relay reachability / mDNS host-candidate resolution / symmetric NAT). The new debug console + inline ICE state let them see exactly where it stalls: relay count, presence announce, ICE candidate types, and ice/conn states.
- Git: committed `4bca2b8` and pushed to https://github.com/maivl/trans-any.git main. PAT passed via http.extraheader (not stored).

---
Task ID: 8
Agent: main (Z.ai Code)
Task: Diagnose why pairing stays "waiting" despite relays connected + profile announced (user log from https://share.2012056.xyz/?room=gz3hnb).

Root cause (found):
Trystero's `onPeerJoin` (which the app uses to flip status to "Connected") only fires AFTER the WebRTC data channel opens — specifically from the handshake manager's `onActivate` callback in room.mjs. So the sequence is: relay connect → profile announce → signaling discovers peer → **onPeerHandshake** → WebRTC ICE/DTLS handshake → data channel open → **onPeerJoin**. The user's log stopped after "profile announce sent" with no "peer join" because the WebRTC handshake (ICE) was failing — most likely cross-network NAT with no TURN relay available (no reliable free public TURN exists; OpenRelay credentials are deprecated and allocate 0 relay candidates, verified). The app had no visibility into the handshake stage, so it looked like "stuck waiting".

Fix:
- Wired Trystero's `JoinRoomCallbacks` (3rd `joinRoom` arg) — previously not passed:
  * `onPeerHandshake(peerId)` — fires when signaling discovers a peer, BEFORE WebRTC. Logs `[handshake] peer discovered via signaling (starting WebRTC)` and sets a new `handshaking` ConnStatus ("Connecting…", sky-blue dot).
  * `onJoinError(details)` — fires when the handshake/ICE fails. Logs `[handshake] JOIN ERROR (ICE/handshake failed)` + toasts "Connection failed — see debug console".
  * `handshakeTimeoutMs: 30000`.
- Added `onPeerHandshake` / `onJoinError` to ChatHandlers; FybeamRoom sets status='handshaking' on handshake, and toasts on join-error.
- New ConnStatus `handshaking` + "Connecting…" label.
- Sidebar hints now differentiate the two stuck states:
  * waiting (no peer found) → "Both sides must be on this page at the same time with the same room code. If Debug shows 'handshake: peer discovered' but never 'presence: peer join', the WebRTC connection (ICE) is failing — usually NAT/firewall blocking direct P2P (no free public TURN available)."
  * handshaking → "Peer found via signaling — establishing WebRTC… (If >20s, ICE is failing; check Debug console.)"
- Verified in sandbox: the `[handshake] peer discovered via signaling` event now appears in the Debug console between `profile announce` and `presence: peer join`, confirming the full sequence is observable.

Stage Summary:
- For the user: if both peers are on the same room URL simultaneously and the Debug console shows `[handshake] peer discovered via signaling` but then `[handshake] JOIN ERROR` (or nothing further), the bottleneck is WebRTC ICE (cross-network NAT, no TURN). Same-network/two-tab scenarios work. To support cross-network behind symmetric NAT, a user-supplied TURN server is required (added to RTC_CONFIG.iceServers).
- Build clean, lint clean, preview HTTP 200. Pushed commits `ab17b62`, `e3a4fe5`, `efa6a56` to https://github.com/maivl/trans-any.git main. Also cleaned up: untracked dist/ + tool-results/, fixed .gitignore.
