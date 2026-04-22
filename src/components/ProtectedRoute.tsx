import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Security Fix: Constant-time authentication check to prevent timing attacks
      const startTime = Date.now();
      const MIN_RESPONSE_TIME = 200; // Minimum response time in ms
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Add artificial delay to match role check timing
          const elapsed = Date.now() - startTime;
          await new Promise(resolve => 
            setTimeout(resolve, Math.max(0, MIN_RESPONSE_TIME - elapsed))
          );
          setAuthorized(false);
          setLoading(false);
          return;
        }

        if (requiredRole) {
          const { data, error } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: requiredRole as any
          });

          // Also allow support_agent users to enter /admin (they're filtered downstream)
          let allowSupportAgent = false;
          if (requiredRole === 'admin' && !data) {
            const { data: isSA } = await supabase.rpc('has_role', {
              _user_id: user.id,
              _role: 'support_agent' as any,
            });
            allowSupportAgent = !!isSA;
          }

          // Ensure consistent timing regardless of success/failure
          const elapsed = Date.now() - startTime;
          await new Promise(resolve =>
            setTimeout(resolve, Math.max(0, MIN_RESPONSE_TIME - elapsed))
          );

          if (error) {
            console.error('Role check error:', error);
            setAuthorized(false);
          } else {
            setAuthorized(!!data || allowSupportAgent);
          }
        } else {
          // Ensure consistent timing for non-role checks too
          const elapsed = Date.now() - startTime;
          await new Promise(resolve => 
            setTimeout(resolve, Math.max(0, MIN_RESPONSE_TIME - elapsed))
          );
          setAuthorized(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Still maintain timing consistency on error
        const elapsed = Date.now() - startTime;
        await new Promise(resolve => 
          setTimeout(resolve, Math.max(0, MIN_RESPONSE_TIME - elapsed))
        );
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [requiredRole]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};