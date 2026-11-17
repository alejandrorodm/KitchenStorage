import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Kitchen Storage',
        lang: 'es',
        short_name: 'Cocina',
        description: 'Nevera, congelador y despensa, planificador de comidas y lista de la compra',
        theme_color: '#2f6b4f',
        background_color: '#f2f6f4',
        display: 'standalone',
        start_url: '/',
        // PNG icons are required by Android (install prompt and the TWA app built in deploy/android).
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Latin fonts are cached so the installed app keeps its typography offline.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}', 'assets/*-latin-*.woff2'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
});
