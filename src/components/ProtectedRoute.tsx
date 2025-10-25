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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        if (requiredRole) {
          const { data, error } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: requiredRole as 'admin' | 'institution'
          });

          if (error) {
            console.error('Role check error:', error);
            setAuthorized(false);
          } else {
            setAuthorized(data);
          }
        } else {
          setAuthorized(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
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