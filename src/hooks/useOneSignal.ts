import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void | Promise<void>>;
  }
}

/**
 * Registers the current authenticated user with OneSignal and sets
 * institution-scoped tags so push notifications can be targeted
 * per tenant / per user.
 */
export function useOneSignal(institutionId?: string) {
  const registered = useRef(false);
  // Read current language so push targeting can localize per recipient.
  // Falls back gracefully if Provider isn't mounted (e.g. unit tests).
  let language: 'en' | 'fr' = 'en';
  try {
    language = useLanguage().language as 'en' | 'fr';
  } catch { /* no provider in this tree */ }

  useEffect(() => {
    const register = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          // Guard: SDK may not be fully initialized
          if (!OneSignal || typeof OneSignal?.login !== 'function') {
            console.warn('[OneSignal] SDK not ready, skipping registration');
            return;
          }

          // Login with external user id for cross-device targeting (idempotent)
          if (!registered.current) {
            await OneSignal.login(user.id);
          }

          // Set tags for multi-tenancy filtering + locale targeting.
          // We re-emit on every language change so the language tag stays current.
          if (OneSignal.User && typeof OneSignal.User.addTags === 'function') {
            // Audience isolation: tag every device with an `env` segment so
            // production sends never reach QA/test devices and vice-versa.
            // Override per device via localStorage.setItem('onesignal_env','test').
            const envTag =
              (typeof localStorage !== 'undefined' && localStorage.getItem('onesignal_env')) ||
              (import.meta.env.MODE === 'production' ? 'production' : 'test');

            const tags: Record<string, string> = {
              user_id: user.id,
              email: user.email || '',
              language,
              env: envTag,
            };

            if (institutionId) {
              tags.institution_id = institutionId;
            }

            await OneSignal.User.addTags(tags);
          }

          registered.current = true;
        } catch (err) {
          // Silently handle — OneSignal failures should not break the app
          console.warn('[OneSignal] Registration skipped:', (err as any)?.message || err);
        }
      });
    };

    register();
  }, [institutionId, language]);
}
