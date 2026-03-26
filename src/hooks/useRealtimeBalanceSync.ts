import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on account_balances and transactions tables,
 * scoped to accounts belonging to the given institution.
 * Automatically invalidates only the institution-scoped query caches so the
 * banking app refreshes instantly for the correct bank only.
 */
export function useRealtimeBalanceSync(userId?: string, institutionId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Fetch account IDs for the current institution to scope realtime filtering
    let accountIds: string[] = [];
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // Get accounts scoped to this user (and institution if provided)
      let query = supabase
        .from('accounts')
        .select('id, account_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }

      const { data } = await query;
      // Exclude Customer App wallet accounts (KANG- prefix) from banking realtime sync
      accountIds = (data || [])
        .filter((a) => !a.account_id?.startsWith('KANG-'))
        .map((a) => a.id);

      

      const channelName = institutionId
        ? `balance-sync-${userId}-${institutionId}`
        : `balance-sync-${userId}`;

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'account_balances' },
          (payload) => {
            const accountId = (payload.new as any)?.account_id || (payload.old as any)?.account_id;
            if (accountIds.length === 0 || accountIds.includes(accountId)) {
              // Use refetchQueries to force immediate refresh despite staleTime
              queryClient.refetchQueries({ queryKey: ['bank-accounts', institutionId] });
              queryClient.refetchQueries({ queryKey: ['account-balances'] });
              queryClient.refetchQueries({ queryKey: ['customer-accounts'] });
              queryClient.refetchQueries({ queryKey: ['spending-summary'] });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          (payload) => {
            const accountId = (payload.new as any)?.account_id || (payload.old as any)?.account_id;
            if (accountIds.length === 0 || accountIds.includes(accountId)) {
              queryClient.refetchQueries({ queryKey: ['bank-transactions', institutionId] });
              queryClient.refetchQueries({ queryKey: ['customer-transactions'] });
              queryClient.refetchQueries({ queryKey: ['bank-accounts', institutionId] });
              queryClient.refetchQueries({ queryKey: ['customer-accounts'] });
              queryClient.refetchQueries({ queryKey: ['spending-summary'] });
            }
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, institutionId, queryClient]);
}
