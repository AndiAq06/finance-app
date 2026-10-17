/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// API Laravel dijalankan di port 8000 (docker compose). Vite mem-proxy /api dan /sanctum
// sehingga browser melihat frontend & API sebagai satu origin -> cookie session Sanctum
// + proteksi CSRF bekerja tanpa menyimpan token di localStorage.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/sanctum': { target: API_TARGET, changeOrigin: false },
      '/storage': { target: API_TARGET, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
