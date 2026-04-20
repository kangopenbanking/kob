/**
 * useHarvestedT — runtime translation lookup for raw English UI strings.
 *
 * Hashes the input with FNV-1a (byte-identical to TranslationHarvester +
 * queueAutoHarvestedString) and looks the result up in the i18next store,
 * which is fed by the public `i18n-bundle` edge function.
 *
 * Fail-open: if no translation exists yet, returns the original English string
 * (the harvester will register it on the next scan, AI translates it, and the
 * next render shows FR).
 */
import { useCallback } from 'react';
import { useLanguage } from './LanguageContext';
import { lookup } from './i18next';

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

export function useHarvestedT(category = 'customer') {
  // Subscribe to language so re-renders happen when locale switches or bundles reload.
  const { language } = useLanguage();
  void language;

  return useCallback(
    (text: string): string => {
      if (!text) return text;
      const key = harvestedKey(text, category);
      const translated = lookup(key);
      return translated || text;
    },
    [category, language],
  );
}
