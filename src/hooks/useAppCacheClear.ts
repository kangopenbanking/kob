import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Auto-clears browser caches (Service Worker, Cache API, React Query)
 * whenever any multi-tenancy app is opened.
 * Runs once per app mount to ensure fresh data.
 */
export function useAppCacheClear() {
  const queryClient = useQueryClient();
  const hasCleared = useRef(false);

  useEffect(() => {
    if (hasCleared.current) return;
    hasCleared.current = true;

    const clearCaches = async () => {
      try {
        // 1. Clear all React Query caches to force fresh data fetches
        queryClient.clear();

        // 2. Clear Cache API (service worker pre-cached assets & runtime caches)
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map((name) => caches.delete(name))
          );
        }

        // 3. Tell the service worker to skip waiting & activate immediately
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }

        // 4. Request fresh service worker check
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.update();
          }
        }
      } catch (err) {
        console.warn('Cache clear failed (non-critical):', err);
      }
    };

    clearCaches();
  }, [queryClient]);
}
