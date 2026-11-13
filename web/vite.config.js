// Web (browser) build of the same React app the desktop uses.
//   npm run web:dev    → http://localhost:5173 (API calls proxied to localhost:4000)
//   npm run web:build  → dist-web/  (deployed to Vercel)
// The desktop preload (src/preload/index.js) is reused as-is: its `import 'electron'` is
// pointed at web/electron-browser.js, so window.api always has exactly the desktop channels.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  publicDir: resolve(here, 'public'),
  envDir: here,
  plugins: [react()],
  resolve: {
    alias: {
      electron: resolve(here, 'electron-browser.js'),
      '@renderer': resolve(here, '../src/renderer/src')
    }
  },
  define: {
    'process.contextIsolated': 'true'
  },
  build: {
    outDir: resolve(here, '../dist-web'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000
  },
  server: {
    port: 5173,
    fs: { allow: [resolve(here, '..')] },
    proxy: { '/api': process.env.API_PROXY || 'http://localhost:4000' }
  }
})
