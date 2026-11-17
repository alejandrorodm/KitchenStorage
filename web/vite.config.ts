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
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
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
