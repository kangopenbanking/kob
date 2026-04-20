import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './translations';
import { supabase } from '@/integrations/supabase/client';

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
  // Determine category from key prefix
  const cat = category || (key.includes('.') ? key.split('.')[0] : 'general');
  if (pendingKeys.some(p => p.key === key)) return;
  pendingKeys.push({ key, default_value: defaultValue, category: cat });

  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushPendingKeys, 3000);
}

/**
 * Public API for the runtime DOM harvester.
 * Accepts a raw English UI string, generates a stable hash key,
 * and queues it for auto-registration + auto-translation.
 */
export function queueAutoHarvestedString(text: string, category = 'auto'): string | null {
  const clean = text.trim();
  if (!clean) return null;
  // Stable FNV-1a 32-bit hash → 8 hex chars
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

async function flushPendingKeys(onSuccess?: (keys: string[]) => void) {
  if (pendingKeys.length === 0) return;
  const batch = [...pendingKeys];
  pendingKeys = [];

  try {
    const { error } = await supabase.functions.invoke('register-translation-strings', {
      body: { strings: batch },
    });
    if (error) throw error;
    onSuccess?.(batch.map(b => b.key));
  } catch (e) {
    console.warn('Failed to register translation keys:', e);
    // Re-queue failed keys for retry on next tick
    pendingKeys.push(...batch);
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(() => flushPendingKeys(onSuccess), 30000);
  }
}

// Read stored language synchronously to avoid initial-paint flash (FOUT) for FR users.
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
  const [dbTranslations, setDbTranslations] = useState<Record<string, string>>({});
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(true);
  const registeredKeysRef = useRef<Set<string>>(new Set());

  // Load translations from DB
  const loadDbTranslations = useCallback(async (lang: Language) => {
    try {
      // Paginate to handle >1000 rows
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('translation_values')
          .select('value, string_id, translation_strings!inner(string_key)')
          .eq('language', lang)
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.warn('Failed to load DB translations:', error);
          break;
        }
        if (data) allData = allData.concat(data);
        hasMore = data && data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const map: Record<string, string> = {};
      const keys = new Set<string>();
      for (const row of allData) {
        const key = (row as any).translation_strings?.string_key;
        if (key) {
          map[key] = row.value;
          keys.add(key);
        }
      }
      setDbTranslations(map);
      registeredKeysRef.current = keys;
    } catch (e) {
      console.warn('Error loading translations:', e);
    } finally {
      setIsLoadingTranslations(false);
    }
  }, []);

  useEffect(() => {
    // Load language preference
    const loadLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.language) {
          setLanguageState(data.language as Language);
          await loadDbTranslations(data.language as Language);
          return;
        }
      } else {
        const stored = localStorage.getItem('language') as Language;
        if (stored && (stored === 'en' || stored === 'fr')) {
          setLanguageState(stored);
          await loadDbTranslations(stored);
          return;
        }
      }
      await loadDbTranslations('en');
    };

    loadLanguage();
  }, [loadDbTranslations]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    loadDbTranslations(lang);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, language: lang }, { onConflict: 'user_id' });
    }
  };

  const t = useCallback((key: TranslationKey): string => {
    // 1. Try DB translation first
    if (dbTranslations[key]) {
      return dbTranslations[key];
    }

    // 2. Fallback to static translations
    const staticValue = translations[language]?.[key] || translations.en[key];

    // 3. Auto-register if not in DB yet (resilient: only mark on flush success)
    if (!registeredKeysRef.current.has(key) && staticValue) {
      queueKeyForRegistration(key, translations.en[key] || staticValue);
    }

    return staticValue || key;
  }, [language, dbTranslations]);

  // Sync <html lang> + <html dir> with current language for SEO,
  // screen readers, and browser-native translation prompts.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = 'ltr'; // FR is LTR; placeholder for future RTL locales
      const meta = document.querySelector('meta[http-equiv="content-language"]');
      if (meta) meta.setAttribute('content', language);
    }
  }, [language]);

  // Realtime: listen for admin edits to translations and refresh
  useEffect(() => {
    const channel = supabase
      .channel('translation-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'translation_values' },
        () => loadDbTranslations(language))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'translation_strings' },
        () => loadDbTranslations(language))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [language, loadDbTranslations]);

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
