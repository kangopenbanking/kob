import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on account_balances and transactions tables.
 * Automatically invalidates the relevant query caches so the UI refreshes instantly
 * when funds are added, transferred, or withdrawn.
 */
export function useRealtimeBalanceSync(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`balance-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'account_balances' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['account-balances'] });
          queryClient.invalidateQueries({ queryKey: ['spending-summary'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
          queryClient.invalidateQueries({ queryKey: ['account-balances'] });
          queryClient.invalidateQueries({ queryKey: ['spending-summary'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
