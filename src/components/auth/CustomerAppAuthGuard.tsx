import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

/**
 * Guards Customer App routes — requires an authenticated user with
 * a profile (registered customer).
 *
 * If the stored auth token is corrupt / rejected by GoTrue (e.g. the
 * "missing sub claim" 403 we observed after a stale magic-link session
 * was written into localStorage), we forcibly sign out so the user can
 * actually log in again rather than getting stuck in a redirect loop.
 */
export const CustomerAppAuthGuard: React.FC<Props> = ({ children }) => {
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (cancelled) return;

        if (userErr || !user) {
          // Bad / stale token — clear it so the next /app/auth visit is clean.
          if (userErr) {
            await supabase.auth.signOut().catch(() => {});
          }
          setState('unauthorized');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;
        setState(profile ? 'authorized' : 'unauthorized');
      } catch {
        if (cancelled) return;
        await supabase.auth.signOut().catch(() => {});
        setState('unauthorized');
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'unauthorized') {
    return <Navigate to="/app/auth" replace />;
  }

  return <>{children}</>;
};
