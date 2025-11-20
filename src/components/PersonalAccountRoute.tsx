import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PersonalAccountRouteProps {
  children: React.ReactNode;
}

export const PersonalAccountRoute = ({ children }: PersonalAccountRouteProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
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

        // Check if user has 'personal' role
        const { data: isPersonal } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'personal'
        });

        // Ensure consistent timing regardless of result
        const elapsed = Date.now() - startTime;
        await new Promise(resolve => 
          setTimeout(resolve, Math.max(0, MIN_RESPONSE_TIME - elapsed))
        );

        if (isPersonal) {
          // Personal accounts cannot access this route
          toast.error('This feature is not available for personal accounts', {
            description: 'Personal accounts can only access Credit Score features'
          });
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      } catch (error) {
        console.error('Access check error:', error);
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

    checkAccess();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/credit-score" replace />;
  }

  return <>{children}</>;
};
