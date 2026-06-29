/**
 * Cache busting + legacy banner state purge.
 *
 * Runs once at app boot. When APP_CACHE_VERSION changes between deploys,
 * we wipe stale localStorage / sessionStorage keys that used to drive the
 * old in-app banners (migration nag, health overlay, legacy promos) so
 * nothing flashes on the next launch.
 *
 * Bump APP_CACHE_VERSION whenever a deploy ships UI/state changes that
 * must not surface stale data to returning users.
 */

const APP_CACHE_VERSION = "2026.06.29-01";
const VERSION_KEY = "kob:cache-version";

// Legacy banner / promo state keys that must never re-render.
const LEGACY_BANNER_KEYS = [
  "migration-banner-dismissed",
  "health-banner-dismissed",
  "balance-reconciliation-banner",
  "kob-promo-banner",
  "kob-launch-banner",
  "kob-announcement-banner",
];

function purgeLegacyBannerState() {
  try {
    for (const key of LEGACY_BANNER_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    // Also sweep any future banner-prefixed keys.
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const k = storage.key(i);
        if (k && /banner|promo|announcement/i.test(k) && k.startsWith("kob")) {
          storage.removeItem(k);
        }
      }
    }
  } catch {
    /* storage unavailable — ignore */
  }
}

async function purgeStaleCaches() {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        // Keep messaging worker caches (Firebase, OneSignal); only sweep app-shell caches.
        .filter((n) => /workbox|precache|runtime|kob-app|vite/i.test(n))
        .map((n) => caches.delete(n)),
    );
  } catch {
    /* ignore */
  }
}

export function runCacheBust() {
  try {
    const stored = localStorage.getItem(VERSION_KEY);
    if (stored !== APP_CACHE_VERSION) {
      purgeLegacyBannerState();
      void purgeStaleCaches();
      localStorage.setItem(VERSION_KEY, APP_CACHE_VERSION);
    }
  } catch {
    /* ignore */
  }
}
