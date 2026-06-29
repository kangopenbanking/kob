import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { runCacheBust } from "./lib/cache-bust";

// Purge legacy banner state and stale caches on every boot.
runCacheBust();

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
