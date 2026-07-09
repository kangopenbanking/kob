/**
 * Guarded service-worker registration.
 *
 * Refuses to register in Lovable preview / dev / iframe contexts so the
 * editor never gets a stuck SW. Also honours `?sw=off` as a kill switch.
 *
 * Called from src/main.tsx at boot.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get('sw') === 'off') {
    unregisterAppServiceWorkers();
    return;
  }

  const host = window.location.hostname;
  const isPreview =
    host.startsWith('id-preview--') ||
    host.startsWith('preview--') ||
    host === 'lovableproject.com' ||
    host.endsWith('.lovableproject.com') ||
    host === 'lovableproject-dev.com' ||
    host.endsWith('.lovableproject-dev.com') ||
    host === 'beta.lovable.dev' ||
    host.endsWith('.beta.lovable.dev');
  const isIframe = window.top !== window.self;

  if (isPreview || isIframe) {
    unregisterAppServiceWorkers();
    return;
  }

  // vite-plugin-pwa emits /sw.js at the site root.
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[pwa] SW registration failed:', err);
  });
}

async function unregisterAppServiceWorkers() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const scriptURL = reg.active?.scriptURL || '';
      // Only unregister our own app SW, leave OneSignal / FCM workers alone.
      if (scriptURL.endsWith('/sw.js')) {
        await reg.unregister();
      }
    }
  } catch {
    // no-op
  }
}
