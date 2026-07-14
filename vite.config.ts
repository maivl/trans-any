import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Pure Vite + SolidJS app served from the project root on port 3000.
export default defineConfig({
  base: '/',
  plugins: [
    solid(),
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
