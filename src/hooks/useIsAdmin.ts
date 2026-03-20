import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns true if the current user has the 'admin' role.
 * Admins bypass all plan-tier restrictions across the platform.
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin' as any,
        });
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  return { isAdmin, loading };
}
