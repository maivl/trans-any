import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Pure Vite + vanilla Web Components (no framework). Served from the repo root.
export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(),
    // Helia / libp2p reference Node-style globals (Buffer, process, global).
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
