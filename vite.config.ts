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
    proxy: {
      "/supabase-proxy": {
        target: "https://vhzdbhdyytvaipkbcsvs.supabase.co",
        changeOrigin: true,
        secure: true,
        ws: true,
        timeout: 120000,
        proxyTimeout: 120000,
        rewrite: (p) => p.replace(/^\/supabase-proxy/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("cookie");
          });
          proxy.on("error", (err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: `Connexion internet ou liaison vers Supabase interrompue (${err.message}).`,
                })
              );
            }
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: "DawJang — Studio de Révision Médicale",
        short_name: "DawJang",
        description:
          "Studio IA de préparation aux examens de médecine : Examens blancs, QCM docimologiques, synthèses et flashcards FSRS.",
        theme_color: "#C96442",
        background_color: "#141312",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/dashboard",
        categories: ["education", "medical", "productivity"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Examen Blanc",
            short_name: "Examen Blanc",
            url: "/examen-blanc",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Smart Flashcards",
            short_name: "Flashcards",
            url: "/flashcards",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Nouveau QCM",
            short_name: "QCM",
            url: "/qcm",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/ocr/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-ocr-v7',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] }
            }
          },
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
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "sonner": path.resolve(__dirname, "./src/lib/sonnerAdapter.ts"),
    },
  },
  build: {
    // Never ship source maps to production
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'pdf-vendor': ['@react-pdf/renderer'],
        }
      }
    }
  },
}));
