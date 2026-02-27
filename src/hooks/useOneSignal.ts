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
          // Login with external user id for cross-device targeting
          await OneSignal.login(user.id);

          // Set tags for multi-tenancy filtering
          const tags: Record<string, string> = {
            user_id: user.id,
            email: user.email || '',
          };

          if (institutionId) {
            tags.institution_id = institutionId;
          }

          await OneSignal.User.addTags(tags);
          registered.current = true;
        } catch (err) {
          console.error('[OneSignal] Registration error:', err);
        }
      });
    };

    register();
  }, [institutionId]);
}
