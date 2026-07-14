# fybeam — P2P File Sharing & Chat over WebRTC + IPFS

A serverless, peer-to-peer chat and file-sharing app built with **Vite + SolidJS + TailwindCSS**, using **Trystero** (WebRTC, Nostr-relay signaling) for realtime text/voice/video and **Helia** (in-browser IPFS) for content-addressed file transfer. No server stores your data.

UI style inspired by [fyDrop](https://trans.2012056.xyz) — clean light theme, SF Pro, sidebar with Devices / Transfers / Received sections.

## Features

- 💬 **Realtime text chat** — peer-to-peer over WebRTC data channels
- 🎙️ **Audio calls** — `getUserMedia` → Trystero media streaming
- 📹 **Video calls** — video tracks with mute / cam-off / end controls
- 🪐 **IPFS file transfer** — Helia `addBytes` → CID → shared via Trystero → peer fetches via Helia `cat` (plus public-gateway fallback)
- 📲 **QR code room sharing** — generate a QR / share link for the room; scanning it opens the app with the room code pre-filled
- 🔗 **Connection diagnostics** — live signaling-relay counter + waiting hints
- 📱 **Responsive** — desktop sidebar layout; mobile top-header + bottom tab bar

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Vite + SolidJS (TypeScript) |
| Styling | Tailwind CSS v4 |
| WebRTC signaling | Trystero v0.25 (Nostr strategy) |
| In-browser IPFS | Helia v5 + @helia/unixfs |
| QR codes | `qrcode` |

## Getting started

```bash
cd solid-chat
bun install
bun run dev          # builds + serves on http://localhost:3000
```

Open the app in two browser tabs/windows (or share the room code / QR with someone). Enter a name, generate or enter a room code, and join — peers discover each other via Nostr relays and connect directly over WebRTC.

### How pairing works

Trystero signals peer presence over a set of public Nostr relays (WSS). Both peers must reach at least one shared relay. The sidebar shows a live `Signaling N/M relays` indicator. Once a relay pairs them, a direct WebRTC connection is established (host + STUN candidates); no server relays the actual chat/media.

## Project structure

```
solid-chat/
├── src/
│   ├── components/   # JoinScreen, RoomShell, Sidebar, ChatView, FilesView,
│   │                 # VideoTile, MessageInput, QRShareModal, Toaster
│   ├── lib/          # chat.ts (Trystero), ipfs.ts (Helia), qr.ts, utils.ts
│   ├── store.ts      # Solid signals (global state)
│   ├── types.ts
│   └── index.tsx
├── vite.config.ts
└── package.json
```

## Notes & limitations

- **No TURN**: free public TURN relays are unreliable; same-network / typical NAT scenarios work via host + STUN candidates. Cross-network behind symmetric NAT would need a user-supplied TURN server.
- **IPFS file fetch**: in-browser Helia bitswap between two browser nodes can be slow without a pinning service; file metadata + CID sharing is reliable. Add a pinning service (web3.storage / Pinata) for production-grade availability.
- **Camera/mic**: requires a secure context (HTTPS) or localhost; the preview must grant media permissions.
