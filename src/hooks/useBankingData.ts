import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Accounts & Balances ───
export function useBankAccounts() {
  const { institutionId } = useParams();
  return useQuery({
    queryKey: ['bank-accounts', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*, account_balances(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useTotalBalance() {
  const { data: accounts } = useBankAccounts();
  
  const totalXAF = (accounts || []).reduce((sum, acc) => {
    const balance = acc.account_balances?.[0]?.amount || 0;
    return sum + (acc.currency === 'XAF' ? balance : 0);
  }, 0);

  const accountsByurrency = (accounts || []).reduce<Record<string, { balance: number; label: string }>>((map, acc) => {
    const balance = acc.account_balances?.[0]?.amount || 0;
    if (!map[acc.currency]) {
      map[acc.currency] = { balance: 0, label: acc.nickname || `${acc.currency} Account` };
    }
    map[acc.currency].balance += balance;
    return map;
  }, {});

  return { totalXAF, accountsByurrency, accounts };
}

// ─── Transactions ───
export function useBankTransactions(limit = 10) {
  return useQuery({
    queryKey: ['bank-transactions', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Savings ───
export function useSavingsAccounts() {
  return useQuery({
    queryKey: ['savings-accounts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('savings_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSavingsDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ savings_account_id, amount }: { savings_account_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke('savings-deposit', {
        body: { savings_account_id, amount },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Deposit successful!');
    },
    onError: (err: any) => toast.error(err.message || 'Deposit failed'),
  });
}

export function useSavingsWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ savings_account_id, amount }: { savings_account_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke('savings-withdraw', {
        body: { savings_account_id, amount },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Withdrawal successful!');
    },
    onError: (err: any) => toast.error(err.message || 'Withdrawal failed'),
  });
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      product_id: string;
      account_name: string;
      opening_deposit: number;
      target_amount?: number;
      target_date?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('savings-create', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-accounts'] });
      toast.success('Savings goal created!');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create savings goal'),
  });
}

// ─── Loans ───
export function useLoanApplications() {
  return useQuery({
    queryKey: ['loan-applications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('loan_applications')
        .select('*, loan_product:loan_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useLoanProducts() {
  return useQuery({
    queryKey: ['loan-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useApplyForLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      loan_product_id: string;
      requested_amount: number;
      tenure_months: number;
      purpose: string;
      submit?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('loan-apply', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-applications'] });
      toast.success('Loan application submitted!');
    },
    onError: (err: any) => toast.error(err.message || 'Application failed'),
  });
}

// ─── Credit Score ───
export function useCreditScore() {
  return useQuery({
    queryKey: ['credit-score'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, include_report: false },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

// ─── Virtual Cards ───
export function useVirtualCards() {
  return useQuery({
    queryKey: ['virtual-cards'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('virtual-card-list');
      if (error) throw error;
      return data?.cards || [];
    },
  });
}

export function useCreateVirtualCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { card_type?: string; currency?: string; spending_limit?: number }) => {
      const { data, error } = await supabase.functions.invoke('virtual-card-create', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-cards'] });
      toast.success('Virtual card created!');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create card'),
  });
}

export function useTopUpCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ card_id, amount }: { card_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke('virtual-card-topup', {
        body: { card_id, amount },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-cards'] });
      toast.success('Card topped up!');
    },
    onError: (err: any) => toast.error(err.message || 'Top-up failed'),
  });
}

export function useUpdateCardStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ card_id, status }: { card_id: string; status: string }) => {
      const { data, error } = await supabase.functions.invoke('virtual-card-update-status', {
        body: { card_id, status },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-cards'] });
      toast.success(data?.message || 'Card status updated!');
    },
    onError: (err: any) => toast.error(err.message || 'Status update failed'),
  });
}

// ─── Transfers ───
export function useSendTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      source_account_id: string;
      destination_account_id: string;
      amount: number;
      currency?: string;
      description?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('api-transfers', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      toast.success('Transfer sent successfully!');
    },
    onError: (err: any) => toast.error(err.message || 'Transfer failed'),
  });
}

// ─── Mobile Money ───
export function useMobileMoneyCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      phone_number: string;
      amount: number;
      currency?: string;
      provider?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('mobile-money-charge', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      toast.success('Mobile Money transfer initiated!');
    },
    onError: (err: any) => toast.error(err.message || 'Transfer failed'),
  });
}

// ─── Beneficiaries (for Quick Send) ───
export function useBeneficiaries() {
  return useQuery({
    queryKey: ['beneficiaries'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Export Statement ───
export function useExportStatement() {
  return useMutation({
    mutationFn: async (body: { format?: string; start_date?: string; end_date?: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-bank-statement', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success('Statement generated!'),
    onError: (err: any) => toast.error(err.message || 'Export failed'),
  });
}
