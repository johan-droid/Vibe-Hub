import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^isomorphic-git\/http\/web$/,
        replacement: path.resolve(__dirname, '../node_modules/isomorphic-git/http/web/index.js'),
      },
      {
        find: /^isomorphic-git$/,
        replacement: path.resolve(__dirname, '../node_modules/isomorphic-git/index.js'),
      },
    ],
  },
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    VitePWA({
      registerType: 'autoUpdate',
      cleanupOutdatedCaches: true,
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      },
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})
