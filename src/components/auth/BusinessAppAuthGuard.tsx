import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

/**
 * Guards Business PWA routes (/biz/*) — requires an authenticated user who is EITHER:
 *   • an owner of a gateway_merchant record, OR
 *   • an active merchant_staff_roles entry, OR
 *   • a global admin
 *
 * F35 hardening (parity with BankingAppAuthGuard):
 *   Previously /biz only relied on SessionGuard (which only verifies a session
 *   exists). That allowed any authenticated consumer to mount the Business
 *   PWA shell by typing /biz/home directly. Operational tooling must be
 *   limited to merchant principals.
 */
export const BusinessAppAuthGuard: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setState('unauthorized');
          return;
        }

        const [adminRes, ownerRes, staffRes] = await Promise.all([
          supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as any }),
          supabase
            .from('gateway_merchants')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('merchant_staff_roles')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),
        ]);

        const authorized =
          Boolean(adminRes.data) ||
          Boolean(ownerRes.data) ||
          Boolean(staffRes.data);

        if (!cancelled) setState(authorized ? 'authorized' : 'unauthorized');
      } catch {
        if (!cancelled) setState('unauthorized');
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
    // Preserve attempted path so post-login can redirect back.
    return <Navigate to="/biz/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
