/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo-name>/; the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Keeper',
        short_name: 'Keeper',
        description: 'Daily profit and loss for your Pakistani mutual funds, priced from MUFAP.',
        theme_color: '#0f3d36',
        background_color: '#0f3d36',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app itself is cached; MUFAP data is cached by the app in local storage.
        // The page is not precached: it's fetched network-first, so a normal refresh picks up a new
        // version straight away, and the last copy is used only when offline.
        globPatterns: ['**/*.{js,css,svg,png}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'keeper-pages', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
