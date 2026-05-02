import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
      includeAssets: ['favicon.png', 'kob-logo.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
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
}));
