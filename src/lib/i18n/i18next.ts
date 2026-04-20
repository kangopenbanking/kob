/**
 * i18next runtime layer for the platform.
 *
 * Why this exists:
 *  - We keep the DB-driven translation system (admin UI, harvester, AI auto-translate,
 *    4,624 reviewed strings, realtime sync) UNCHANGED.
 *  - i18next becomes the *rendering engine* underneath the existing t() / useHarvestedT()
 *    helpers. This gives us: Suspense (no FOUT), pluralization, ICU interpolation,
 *    namespace-based code-splitting, and easy future RTL.
 *
 * Bundles are fetched from the public `i18n-bundle` edge function which returns
 *   { [string_key]: value }
 * per (lang, namespace). Namespace == translation_strings.category.
 *
 * Compatibility contract (do NOT break):
 *  - useLanguage().t(key)  → returns translated string or key fallback.
 *  - useHarvestedT(cat)(t) → returns translated string or original English fallback.
 *  - Static translations.ts file remains the EN baseline for known keys.
 */
import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import { translations as staticTranslations } from './translations';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BUNDLE_URL = `${SUPABASE_URL}/functions/v1/i18n-bundle`;

// All known namespaces (translation_strings.category values).
// `auto` = harvester catch-all, `general` = legacy static keys.
export const ALL_NAMESPACES = ['general', 'auto', 'customer', 'business', 'banking'] as const;
export type Namespace = typeof ALL_NAMESPACES[number];

// Per-app namespace scoping — keeps bundles small.
export const APP_NAMESPACES: Record<string, Namespace[]> = {
  customer: ['general', 'auto', 'customer'],
  business: ['general', 'auto', 'business'],
  banking:  ['general', 'auto', 'banking'],
  all:      [...ALL_NAMESPACES],
};

// Default load set: everything (safe for shared layouts / admin).
const NAMESPACES = [...ALL_NAMESPACES];

// Seed `general` namespace from the static translations file so legacy
// TranslationKey lookups work instantly on first paint (zero FOUT for known keys).
const seedResources = {
  en: { general: { ...staticTranslations.en } },
  fr: { general: { ...staticTranslations.fr } },
};

let initPromise: Promise<unknown> | null = null;

export function initI18n(lang: 'en' | 'fr' = 'en'): Promise<unknown> {
  if (initPromise) return initPromise;

  initPromise = i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
      lng: lang,
      fallbackLng: 'en',
      ns: NAMESPACES,
      defaultNS: 'general',
      fallbackNS: NAMESPACES,
      resources: seedResources,
      partialBundledLanguages: true,
      load: 'languageOnly',
      interpolation: { escapeValue: false }, // React already escapes
      returnEmptyString: false,
      saveMissing: false, // Harvester handles registration server-side
      backend: {
        // {{lng}} = language, {{ns}} = namespace
        loadPath: `${BUNDLE_URL}?lang={{lng}}&ns={{ns}}`,
        // Custom parser: edge function returns flat { key: value }
        parse: (data: string) => {
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        requestOptions: { cache: 'default' },
      },
      react: {
        useSuspense: false, // We manage loading via existing isLoadingTranslations
      },
    });

  return initPromise;
}

/**
 * Look up a key against the merged store of all namespaces.
 * Returns the translated string, or `undefined` if no namespace knows it.
 */
export function lookup(key: string): string | undefined {
  if (!i18n.isInitialized) return undefined;
  for (const ns of NAMESPACES) {
    if (i18n.exists(key, { ns })) {
      const v = i18n.t(key, { ns, defaultValue: '' });
      if (v) return v as string;
    }
  }
  return undefined;
}

/** Reload all namespaces for the current language (called on realtime DB changes). */
export async function reloadAll(lang: string) {
  if (!i18n.isInitialized) return;
  await i18n.reloadResources(lang, NAMESPACES);
  // Force a re-render in subscribers
  i18n.emit('languageChanged', lang);
}

/** Switch language and ensure all namespaces are loaded. */
export async function switchLanguage(lang: 'en' | 'fr', namespaces: readonly string[] = NAMESPACES) {
  await initI18n(lang);
  await i18n.changeLanguage(lang);
  await i18n.loadNamespaces(namespaces as string[]);
}

/** Load a specific app's namespace subset on demand (per-app scoping). */
export async function loadAppNamespaces(app: keyof typeof APP_NAMESPACES) {
  if (!i18n.isInitialized) return;
  await i18n.loadNamespaces(APP_NAMESPACES[app] as string[]);
}

/**
 * Plural helper. Uses i18next's built-in CLDR plural rules.
 * Usage in DB: register two keys `key_one` and `key_other` (i18next convention).
 *   t('cart.items', { count: 1 })  → "1 item"
 *   t('cart.items', { count: 5 })  → "5 items"
 */
export function tPlural(key: string, count: number, opts: Record<string, unknown> = {}): string {
  if (!i18n.isInitialized) return String(count);
  return i18n.t(key, { count, ...opts, defaultValue: '' }) as string;
}

/** Interpolation helper: t('hi', { name: 'Ada' }) → "Hi, Ada" */
export function tInterp(key: string, vars: Record<string, unknown>): string {
  if (!i18n.isInitialized) return key;
  return i18n.t(key, { ...vars, defaultValue: '' }) as string;
}

export { i18n };
