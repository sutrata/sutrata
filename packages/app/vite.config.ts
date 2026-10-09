import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/**'],
      workbox: {
        // Dictionaries are large and used by one language at a time: cached when first used, not at install.
        globIgnores: ['dict/**'],
        runtimeCaching: [{
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/dict/'),
          handler: 'CacheFirst',
          options: { cacheName: 'dictionaries' },
        }],
      },
      manifest: {
        name: 'Sutrata',
        short_name: 'Sutrata',
        description: 'Multilingual screenplay editor',
        theme_color: '#1a1a18',
        background_color: '#1a1a18',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-prosemirror': [
            'prosemirror-state', 'prosemirror-view', 'prosemirror-model',
            'prosemirror-transform', 'prosemirror-commands', 'prosemirror-keymap',
            'prosemirror-history', 'prosemirror-schema-basic',
          ],
          'vendor-codemirror': [
            '@codemirror/state', '@codemirror/view', '@codemirror/language',
            '@codemirror/commands', '@lezer/highlight',
          ],
        },
      },
    },
  },
})
