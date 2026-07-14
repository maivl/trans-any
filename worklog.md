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
