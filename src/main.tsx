import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { runCacheBust } from "./lib/cache-bust";
import { registerServiceWorker } from "./lib/pwa-register";

// Purge legacy banner state and stale caches on every boot.
runCacheBust();

// Register the PWA service worker (no-op in dev / Lovable preview / iframes).
registerServiceWorker();


// Remove server-rendered fallback content once React hydrates
const ssrFallback = document.getElementById('ssr-fallback');
if (ssrFallback) {
  ssrFallback.remove();
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
