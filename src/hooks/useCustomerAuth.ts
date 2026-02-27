import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerProfile {
  id: string;
  linkedAccountType: string | null;
  isViewOnly: boolean;
  phoneNumber: string | null;
}

export function useCustomerAuth() {
  const [user, setUser] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, phone_number, linked_account_type')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile) {
        const p = profile as any;
        setUser({
          id: p.id,
          linkedAccountType: p.linked_account_type || null,
          isViewOnly: !p.linked_account_type || p.linked_account_type === 'none',
          phoneNumber: p.phone_number || null,
        });
      }
      setLoading(false);
    };

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, isAuthenticated };
}
