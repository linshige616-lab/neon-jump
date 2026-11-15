import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so dist/ works on GitHub Pages, Cloudflare Pages and any static host.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  },
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' }
})
