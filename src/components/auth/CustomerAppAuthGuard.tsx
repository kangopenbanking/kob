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
 */
export const CustomerAppAuthGuard: React.FC<Props> = ({ children }) => {
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setState('unauthorized');
          return;
        }

        // Ensure user has a profile (registered customer)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        setState(profile ? 'authorized' : 'unauthorized');
      } catch {
        setState('unauthorized');
      }
    };
    check();
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
