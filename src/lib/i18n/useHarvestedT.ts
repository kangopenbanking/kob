/**
 * useHarvestedT — runtime translation lookup for raw English UI strings.
 *
 * Pairs with TranslationHarvester + queueAutoHarvestedString in
 * LanguageContext.tsx. The harvester walks the DOM, hashes each visible
 * English string with FNV-1a (32-bit, 8 hex chars), prefixes it with a
 * category, and registers it for AI translation. This hook hashes the
 * SAME way and looks up the FR (or active locale) value from the DB
 * snapshot already loaded by LanguageProvider.
 *
 * Design rules:
 *  - ADDITIVE ONLY: never throws, never breaks rendering.
 *  - FAIL OPEN: returns the original English string if no translation found.
 *  - ZERO ROUND-TRIPS: relies on dbTranslations already cached in context.
 *  - SAFE TO OVERUSE: pure function, idempotent, cheap.
 *
 * Usage:
 *   const tr = useHarvestedT('customer');
 *   <span>{tr('Add Money')}</span>
 */
import { useCallback, useContext } from 'react';
import { useLanguage } from './LanguageContext';

// FNV-1a 32-bit — MUST stay byte-identical to queueAutoHarvestedString().
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function harvestedKey(text: string, category = 'customer'): string {
  return `${category}.${fnv1a(text.trim())}`;
}

/**
 * Returns a translator bound to a category. The returned function takes
 * a raw English UI string and returns the localized version, or the
 * original if no translation exists yet (the harvester will register it
 * on the next scan, AI-translate it, and the next render will show FR).
 */
export function useHarvestedT(category = 'customer') {
  const { t } = useLanguage();

  // We piggy-back on the existing t() lookup so the same DB snapshot,
  // realtime updates, and fallback chain apply. t() also auto-registers
  // the key for missing entries — perfect for new copy.
  return useCallback(
    (text: string): string => {
      if (!text) return text;
      const key = harvestedKey(text, category);
      const translated = t(key as any);
      // If the key has never been registered, t() returns the key itself.
      // In that case, fall back to the original English string so the UI
      // never shows "customer.ab49a108".
      return translated && translated !== key ? translated : text;
    },
    [t, category],
  );
}
