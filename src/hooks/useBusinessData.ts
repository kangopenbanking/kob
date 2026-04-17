import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBusinessData = (merchantId?: string) => {
  // Fetch merchant info — fast direct DB query, critical for UI
  const { data: merchant, isLoading: merchantLoading } = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;
      const { data, error } = await supabase
        .from('gateway_merchants')
        .select('*')
        .eq('id', merchantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch wallet balances — direct DB query (faster, RLS-protected, avoids edge fn 400)
  const { data: wallets, isLoading: walletsLoading, refetch: refetchWallets } = useQuery({
    queryKey: ['merchant-wallets', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('gateway_merchant_wallets')
        .select('*')
        .eq('merchant_id', merchantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
    staleTime: 2 * 60 * 1000, // 2 min
  });

  // Fetch recent settlements — deferred, not needed for initial render
  const { data: settlementsData, isLoading: settlementsLoading } = useQuery({
    queryKey: ['merchant-settlements', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gateway-query', {
        body: { action: 'list-settlements', limit: 10, offset: 0 },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent charges (revenue) — fast direct DB query
  const { data: charges, isLoading: chargesLoading } = useQuery({
    queryKey: ['merchant-charges', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('gateway_charges')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
    staleTime: 60 * 1000, // 1 min
  });

  // Fetch payouts — deferred
  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ['merchant-payouts', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gateway-query', {
        body: { action: 'list-payouts', merchant_id: merchantId, limit: 10, offset: 0 },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate metrics
  const xafWallet = wallets?.find((w: any) => w.currency === 'XAF');
  const availableBalance = xafWallet?.available_balance || 0;
  const pendingBalance = xafWallet?.pending_balance || 0;

  const todayCharges = charges?.filter((c: any) => {
    const today = new Date().toDateString();
    return new Date(c.created_at).toDateString() === today && c.status === 'successful';
  }) || [];

  const todayRevenue = todayCharges.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

  return {
    merchant,
    merchantLoading,
    wallets,
    walletsLoading,
    refetchWallets,
    settlements: settlementsData?.data || [],
    settlementsLoading,
    charges,
    chargesLoading,
    payouts: payoutsData?.data || [],
    payoutsLoading,
    availableBalance,
    pendingBalance,
    todayRevenue,
    todayOrders: todayCharges.length,
    isLoading: merchantLoading,
  };
};
