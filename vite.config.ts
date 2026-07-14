import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Vite + SolidJS. Components are exposed as Web Components (custom elements)
// via Solid's `customElement` renderer.
export default defineConfig({
  base: '/',
  // SPA mode: deep links like /room/<code> and /room/join/<code> fall back to
  // index.html so the client router can handle them.
  appType: 'spa',
  plugins: [
    solid(),
    tailwindcss(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      exclude: ['fs', 'path', 'crypto', 'os', 'child_process'],
    }),
  ],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    ws: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    chunkSizeWarningLimit: 6000,
  },
})
