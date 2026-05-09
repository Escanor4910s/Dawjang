import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'Hippocampus - Révision Médicale',
        short_name: 'Hippocampus',
        description: 'Plateforme IA de révision pour étudiants en médecine. QCM, résumés et flashcards générés automatiquement.',
        theme_color: '#6366f1',
        background_color: '#0f0f23',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['education', 'medical', 'productivity'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            url: '/dashboard',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Nouveau QCM',
            short_name: 'QCM',
            url: '/quiz',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/vhzdbhdyytvaipkbcsvs\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Never ship source maps to production — they expose the full source tree
    sourcemap: mode === 'development',
  },
}));
