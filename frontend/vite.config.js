import { defineConfig } from 'vite';
import process from 'node:process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: 'NOVA',
        short_name: 'NOVA',
        description: 'Plan projects, collaborate, and deliver with NOVA.',
        theme_color: '#5146e5',
        background_color: '#f7f8fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [
          '**/index-*.js',
          '**/react-vendor-*.js',
          '**/motion-vendor-*.js',
          '**/supabase-vendor-*.js',
          '**/rolldown-runtime-*.js',
          '**/workbox-window*.js',
          '**/*.css',
          '**/*.html',
          '**/*.png',
          '**/*.svg',
          '**/*.woff2',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    sourcemap: process.env.VITE_SENTRY_SOURCE_MAPS === 'true',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'supabase-vendor',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 25,
            },
            {
              name: 'motion-vendor',
              test: /node_modules[\\/]motion[\\/]/,
              priority: 20,
            },
            {
              name: 'chart-vendor',
              test: /node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/,
              priority: 15,
            },
            {
              name: 'dnd-vendor',
              test: /node_modules[\\/]@dnd-kit[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
});