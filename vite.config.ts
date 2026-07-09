import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { prerenderDocsPlugin } from "./vite-plugin-prerender-docs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registered manually via src/lib/pwa-register.ts (guarded)
      includeAssets: ['favicon.png', 'kob-logo.png', 'kfs-logo.png'],
      devOptions: { enabled: false },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/~oauth/, /\.[a-zA-Z0-9]+$/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        runtimeCaching: [
          {
            // User-uploaded images and media served from Supabase Storage.
            // Without this, installed PWAs on mobile show broken images the
            // moment the network flickers, because workbox has no handler
            // for cross-origin requests.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-storage-media',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Lovable CDN assets (/__l5e/assets-v1/*) referenced from .asset.json pointers.
            urlPattern: ({ url }) => url.pathname.startsWith('/__l5e/assets-v1/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lovable-cdn-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Generic same-origin image fallback (icons, hero uploads served through app origin).
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: false, // Use existing public/manifest.json
    }),

    prerenderDocsPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundle heavy deps used by /developer/api-explorer so the dev server
  // doesn't 504 while optimizing them on first navigation (swagger-ui-react
  // is ~2MB and previously timed out, breaking the lazy import for the page).
  optimizeDeps: {
    include: ['swagger-ui-react', 'js-yaml'],
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('swagger-ui-react') || id.includes('swagger-ui-dist')) {
            return 'swagger-ui';
          }
          if (id.includes('js-yaml')) {
            return 'openapi-tools';
          }
        },
      },
    },
  },
}));
