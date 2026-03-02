import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

/**
 * Guards Banking App routes — requires authenticated user with an account
 * linked to the specific institution in the URL.
 */
export const BankingAppAuthGuard: React.FC<Props> = ({ children }) => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setState('unauthorized');
          return;
        }

        // Check if user has an account linked to this institution
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('institution_id', institutionId!)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        setState(account ? 'authorized' : 'unauthorized');
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
