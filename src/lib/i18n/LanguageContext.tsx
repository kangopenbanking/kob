import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './translations';
import { supabase } from '@/integrations/supabase/client';
import { initI18n, switchLanguage, reloadAll, lookup, i18n } from './i18next';
import { reportMissingKey } from './missingKeyReporter';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isLoadingTranslations: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Batch queue for auto-registering missing keys
let pendingKeys: { key: string; default_value: string; category: string }[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const seenAutoKeys = new Set<string>();

function queueKeyForRegistration(key: string, defaultValue: string, category?: string) {
  const cat = category || (key.includes('.') ? key.split('.')[0] : 'general');
  if (pendingKeys.some(p => p.key === key)) return;
  pendingKeys.push({ key, default_value: defaultValue, category: cat });

  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushPendingKeys, 3000);
}

export function queueAutoHarvestedString(text: string, category = 'auto'): string | null {
  const clean = text.trim();
  if (!clean) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const key = `${category}.${h.toString(16).padStart(8, '0')}`;
  if (seenAutoKeys.has(key)) return key;
  seenAutoKeys.add(key);
  queueKeyForRegistration(key, clean, category);
  return key;
}

async function flushPendingKeys() {
  if (pendingKeys.length === 0) return;
  const batch = [...pendingKeys];
  pendingKeys = [];
  try {
    const { error } = await supabase.functions.invoke('register-translation-strings', {
      body: { strings: batch },
    });
    if (error) throw error;
  } catch (e) {
    console.warn('Failed to register translation keys:', e);
    pendingKeys.push(...batch);
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(flushPendingKeys, 30000);
  }
}

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem('language');
    if (stored === 'en' || stored === 'fr') return stored;
  } catch { /* localStorage unavailable */ }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(true);
  // Bumped on i18next bundle load / realtime reload to force re-renders.
  const [, setTick] = useState(0);
  const registeredKeysRef = useRef<Set<string>>(new Set());

  // Bootstrap i18next + load this language's bundles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve effective language from user preferences if logged in.
        let effective = readInitialLanguage();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('user_preferences')
            .select('language')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data?.language === 'en' || data?.language === 'fr') {
            effective = data.language;
          }
        }
        if (cancelled) return;
        setLanguageState(effective);
        await initI18n(effective);
        await switchLanguage(effective);
        if (cancelled) return;
        // Track which keys i18next knows about, for harvester de-dup.
        try {
          const store = (i18n as any).store?.data?.[effective] || {};
          const keys = new Set<string>();
          for (const ns of Object.keys(store)) {
            for (const k of Object.keys(store[ns] || {})) keys.add(k);
          }
          registeredKeysRef.current = keys;
        } catch { /* ignore */ }
        setTick(x => x + 1);
      } finally {
        if (!cancelled) setIsLoadingTranslations(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem('language', lang); } catch { /* ignore */ }
    // Reload bundles for the new language so all DB-backed strings refresh.
    await switchLanguage(lang);
    await reloadAll(lang);
    setTick(x => x + 1);
    // Persist to user profile (if logged in).
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, language: lang }, { onConflict: 'user_id' });
    }
    // Notify other tabs / open apps (consumer / business / banking) to refresh.
    try {
      const bc = new BroadcastChannel('kob-language');
      bc.postMessage({ type: 'language-changed', lang });
      bc.close();
    } catch { /* BroadcastChannel unsupported */ }
    // Soft, seamless background refresh so in-memory English literals re-render in the new locale.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kob:language-changed', { detail: { lang } }));
      // Defer slightly so any pending UI state (toast, dialog close) settles first.
      setTimeout(() => {
        try { window.location.reload(); } catch { /* ignore */ }
      }, 350);
    }
  }, []);

  // Cross-tab / cross-app sync: when another tab changes the language, reload here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'language' && (e.newValue === 'en' || e.newValue === 'fr') && e.newValue !== language) {
        window.location.reload();
      }
    };
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('kob-language');
      bc.onmessage = (msg) => {
        if (msg.data?.type === 'language-changed' && msg.data.lang !== language) {
          window.location.reload();
        }
      };
    } catch { /* ignore */ }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
    };
  }, [language]);

  const t = useCallback((key: TranslationKey): string => {
    // 1. i18next (DB-backed bundles, all namespaces)
    const fromDb = lookup(key as string);
    if (fromDb) return fromDb;

    // 2. Static fallback
    const staticValue = translations[language]?.[key] || translations.en[key];

    // 3. Auto-register if not yet known
    if (!registeredKeysRef.current.has(key) && staticValue) {
      registeredKeysRef.current.add(key);
      queueKeyForRegistration(key, translations.en[key] || staticValue);
    }

    // 4. Fallback returned the raw key — telemetry: report missing
    if (!staticValue) {
      reportMissingKey(key as string, language);
      return key as string;
    }

    return staticValue;
  }, [language]);

  // Sync <html lang> + <html dir>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = 'ltr';
      const meta = document.querySelector('meta[http-equiv="content-language"]');
      if (meta) meta.setAttribute('content', language);
    }
  }, [language]);

  // Realtime: admin edits → reload bundles for current language.
  useEffect(() => {
    const reload = async () => {
      await reloadAll(language);
      setTick(x => x + 1);
    };
    const channel = supabase
      .channel('translation-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'translation_values' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'translation_strings' }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [language]);

  // Flush pending keys on unmount
  useEffect(() => {
    return () => {
      if (flushTimeout) clearTimeout(flushTimeout);
      flushPendingKeys();
    };
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoadingTranslations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
