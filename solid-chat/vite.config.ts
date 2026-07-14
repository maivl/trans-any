import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// The SolidJS app is built statically and served from the Next.js `public/chat/`
// folder, then embedded full-screen via a same-origin iframe on the Next.js
// `/` route. `base: '/chat/'` ensures all emitted assets reference `/chat/...`
// which Next.js serves as static files.
export default defineConfig({
  base: '/chat/',
  plugins: [
    solid(),
    tailwindcss(),
    // Helia / libp2p reference Node-style globals (Buffer, process, global).
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      exclude: ['fs', 'path', 'crypto', 'os', 'child_process'],
    }),
  ],
  build: {
    outDir: '../public/chat',
    emptyOutDir: true,
    target: 'esnext',
    chunkSizeWarningLimit: 6000,
  },
})
