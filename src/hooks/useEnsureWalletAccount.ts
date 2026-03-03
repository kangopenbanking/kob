import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { KANG_PLATFORM_ID } from '@/constants/platform';
const KANG_INSTITUTION_ID = KANG_PLATFORM_ID;

/**
 * Ensures the current user has a Kang wallet account in the `accounts` table.
 * Auto-creates one if missing. Returns the account once ready.
 */
export function useEnsureWalletAccount(userId?: string) {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    let cancelled = false;

    const ensure = async () => {
      setLoading(true);
      try {
        // Check for existing account
        const { data: existing } = await supabase
          .from('accounts')
          .select('id, account_holder_name, account_id, currency, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (existing) {
          if (!cancelled) setAccount(existing);
          return;
        }

        // Get user profile for name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', userId)
          .maybeSingle();

        const holderName = profile?.full_name || 'Kang User';
        const accountId = `KANG-${userId.substring(0, 8).toUpperCase()}`;

        const { data: created, error } = await supabase
          .from('accounts')
          .insert({
            user_id: userId,
            account_holder_name: holderName,
            account_id: accountId,
            identification_value: accountId,
            account_type: 'Personal' as any,
            account_subtype: 'Current' as any,
            currency: 'XAF',
            is_active: true,
            institution_id: KANG_INSTITUTION_ID,
          })
          .select('id, account_holder_name, account_id, currency, is_active')
          .single();

        if (error) {
          console.error('Failed to auto-create wallet account:', error);
          // Try fetching again in case of race condition
          const { data: retry } = await supabase
            .from('accounts')
            .select('id, account_holder_name, account_id, currency, is_active')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          if (!cancelled) setAccount(retry || null);
        } else {
          // Also create initial zero balance
          await supabase.from('account_balances').insert({
            account_id: created.id,
            balance_type: 'ClosingAvailable',
            amount: 0,
            currency: 'XAF',
            credit_debit_indicator: 'Credit',
            balance_datetime: new Date().toISOString(),
          });
          if (!cancelled) setAccount(created);
        }
      } catch (err) {
        console.error('useEnsureWalletAccount error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    ensure();
    return () => { cancelled = true; };
  }, [userId]);

  return { account, loading };
}
