import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

/**
 * Guards Banking App routes — requires authenticated user who is EITHER:
 *   • the institution owner, OR
 *   • an active staff member with an admin-flagged position, OR
 *   • a global admin
 *
 * F35 hardening (Phase 16):
 *   The previous implementation only verified that the user had ANY active
 *   account at the institution. That allowed ordinary customers of the bank
 *   to load the Banking App's operational shell. Operational tooling must
 *   be limited to staff/owner/admin principals.
 */
export const BankingAppAuthGuard: React.FC<Props> = ({ children }) => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !institutionId) {
          setState('unauthorized');
          return;
        }

        // Run the three authorization checks in parallel — first hit wins.
        const [adminRes, ownerRes, staffRes] = await Promise.all([
          supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
          supabase.rpc('is_institution_owner', { _user_id: user.id, _institution_id: institutionId }),
          supabase.rpc('is_institution_staff_admin', { _user_id: user.id, _institution_id: institutionId }),
        ]);

        const authorized = Boolean(adminRes.data) || Boolean(ownerRes.data) || Boolean(staffRes.data);
        setState(authorized ? 'authorized' : 'unauthorized');
      } catch {
        setState('unauthorized');
      }
    };
    check();
  }, [institutionId]);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'unauthorized') {
    return <Navigate to={`/bank/${institutionId}/auth`} replace />;
  }

  return <>{children}</>;
};
