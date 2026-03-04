import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerProfile {
  id: string;
  fullName: string | null;
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
        .select('id, full_name, phone_number, linked_account_type')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile) {
        const p = profile as any;
        
        // Also check customer_linked_accounts for accounts added later
        let hasLinkedAccounts = !!(p.linked_account_type && p.linked_account_type !== 'none');
        if (!hasLinkedAccounts) {
          const { data: linked } = await (supabase as any)
            .from('customer_linked_accounts')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .limit(1);
          hasLinkedAccounts = (linked?.length || 0) > 0;
          
          // Auto-update profile if they have linked accounts but profile says none
          if (hasLinkedAccounts && (!p.linked_account_type || p.linked_account_type === 'none')) {
            await supabase.from('profiles').update({ linked_account_type: 'linked' } as any).eq('id', session.user.id);
          }
        }
        
        setUser({
          id: p.id,
          linkedAccountType: hasLinkedAccounts ? (p.linked_account_type || 'linked') : null,
          isViewOnly: !hasLinkedAccounts,
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
