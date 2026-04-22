import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Roles allowed to access this route. Admin always has access. */
  allowedRoles: Array<'personal' | 'institution' | 'tpp' | 'staff' | 'developer' | 'merchant' | 'support_agent'>;
  /** Where to redirect unauthorized users (defaults to /dashboard) */
  redirectTo?: string;
}

/**
 * Route guard that restricts access based on user roles.
 * Admin users always have access to all guarded routes.
 * Users without any of the allowedRoles are redirected.
 */
export const RoleGuard = ({ children, allowedRoles, redirectTo = '/dashboard' }: RoleGuardProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // Admin always has access
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin' as any,
        });

        if (isAdmin) {
          setAuthorized(true);
          setLoading(false);
          return;
        }

        // Check if user is an institution owner (for 'institution' allowedRole)
        if (allowedRoles.includes('institution')) {
          const { data: institution } = await supabase
            .from('institutions')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .maybeSingle();

          if (institution) {
            setAuthorized(true);
            setLoading(false);
            return;
          }
        }

        // Check if user is staff (for 'institution' or 'staff' allowedRole - staff access FI portal)
        if (allowedRoles.includes('institution') || allowedRoles.includes('staff')) {
          const { data: isStaff } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'staff' as any,
          });

          if (isStaff) {
            setAuthorized(true);
            setLoading(false);
            return;
          }
        }

        // Check each allowed role
        for (const role of allowedRoles) {
          if (role === 'institution' || role === 'staff') continue; // already checked above

          // For developer role, check if user has a developer institution
          if (role === 'developer') {
            const { data: devInstitution } = await supabase
              .from('institutions')
              .select('id')
              .eq('user_id', user.id)
              .eq('institution_type', 'developer')
              .eq('status', 'approved')
              .maybeSingle();

            if (devInstitution) {
              setAuthorized(true);
              setLoading(false);
              return;
            }

            // Also check tpp role
            const { data: isTpp } = await supabase.rpc('has_role', {
              _user_id: user.id,
              _role: 'tpp' as any,
            });

            if (isTpp) {
              setAuthorized(true);
              setLoading(false);
              return;
            }
            continue;
          }

          // For merchant role, check via has_role OR merchant_staff_roles
          if (role === 'merchant') {
            const { data: isMerchant } = await supabase.rpc('has_role', {
              _user_id: user.id,
              _role: 'merchant' as any,
            });

            if (isMerchant) {
              setAuthorized(true);
              setLoading(false);
              return;
            }

            // Also check if user is active merchant staff
            const { data: merchantStaff } = await supabase
              .from('merchant_staff_roles')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();

            if (merchantStaff) {
              setAuthorized(true);
              setLoading(false);
              return;
            }
            continue;
          }

          // Generic role check
          const { data: hasRole } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: role as any,
          });

          if (hasRole) {
            setAuthorized(true);
            setLoading(false);
            return;
          }
        }

        // No matching role found
        toast.error('Access denied', {
          description: 'You do not have permission to access this area.',
        });
        setAuthorized(false);
      } catch (error) {
        console.error('RoleGuard check error:', error);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [allowedRoles, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
