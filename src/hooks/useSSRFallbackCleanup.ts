import { useEffect } from 'react';

/**
 * Removes the server-rendered fallback content once the React app has hydrated.
 * The #ssr-fallback div is injected at build time by the prerender-docs Vite plugin
 * to provide crawlers with unique content per documentation route.
 */
export function useSSRFallbackCleanup() {
  useEffect(() => {
    const fallback = document.getElementById('ssr-fallback');
    if (fallback) {
      fallback.remove();
    }
  }, []);
}
