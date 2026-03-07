import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

/**
 * Prevents institution owners and staff from accessing non-FI-portal routes.
 * Redirects them to /fi-portal. Admins are exempt (they need cross-portal access).
 */
export const NonInstitutionRoute = ({ children }: Props) => {
  const [state, setState] = useState<'loading' | 'allowed' | 'blocked'>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setState('allowed'); // ProtectedRoute handles unauthenticated
          return;
        }

        // Admins can access everything
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin' as any,
        });
        if (isAdmin) {
          setState('allowed');
          return;
        }

        // Check if user is institution owner
        const { data: institution } = await supabase
          .from('institutions')
          .select('id, institution_type')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle();

        if (institution && institution.institution_type !== 'developer') {
          setState('blocked');
          return;
        }

        // Check if user is FI staff
        const { data: isStaff } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'staff' as any,
        });
        if (isStaff) {
          setState('blocked');
          return;
        }

        setState('allowed');
      } catch {
        setState('allowed');
      }
    };
    check();
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'blocked') {
    return <Navigate to="/fi-portal" replace />;
  }

  return <>{children}</>;
};
