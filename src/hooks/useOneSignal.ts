import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    if (registered.current) return;

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

          // Login with external user id for cross-device targeting
          await OneSignal.login(user.id);

          // Set tags for multi-tenancy filtering — guard User namespace
          if (OneSignal.User && typeof OneSignal.User.addTags === 'function') {
            const tags: Record<string, string> = {
              user_id: user.id,
              email: user.email || '',
            };

            if (institutionId) {
              tags.institution_id = institutionId;
            }

            await OneSignal.User.addTags(tags);
          }

          registered.current = true;
        } catch (err) {
          // Silently handle — OneSignal failures should not break the app
          console.warn('[OneSignal] Registration skipped:', err?.message || err);
        }
      });
    };

    register();
  }, [institutionId]);
}
