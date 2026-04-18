import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

// Re-export toast for components that import from here

// Helper to get institutionId from route params
function useInstitutionId() {
  const { institutionId } = useParams();
  return institutionId;
}

// ─── Accounts & Balances ───
export function useBankAccounts() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['bank-accounts', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      let query = supabase
        .from('accounts')
        .select('*, account_balances(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .not('account_id', 'like', 'KANG-%')
        .order('created_at', { ascending: false });
      
      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }
      
      const { data, error } = await query;
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
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['bank-transactions', institutionId, limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // If institutionId is set, first get account IDs for this institution
      let accountIds: string[] | null = null;
      if (institutionId) {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('institution_id', institutionId)
          .not('account_id', 'like', 'KANG-%');
        accountIds = (accounts || []).map(a => a.id);
        if (accountIds.length === 0) return [];
      }

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (accountIds) {
        query = query.in('account_id', accountIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Savings ───
export function useSavingsAccounts() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['savings-accounts', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      let query = supabase
        .from('savings_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }) as any;
      
      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSavingsDeposit() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async ({ savings_account_id, amount }: { savings_account_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke('savings-ops', {
        body: { action: 'deposit', savings_account_id, amount, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['savings-accounts', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', institutionId] });
      toast.success(`${variables.amount.toLocaleString()} XAF deposited to your savings account`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not complete your deposit. Please try again.')),
  });
}

export function useSavingsWithdraw() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async ({ savings_account_id, amount }: { savings_account_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke('savings-ops', {
        body: { action: 'withdraw', savings_account_id, amount, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['savings-accounts', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', institutionId] });
      toast.success(`${variables.amount.toLocaleString()} XAF withdrawn from savings. Funds available in your account.`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not process withdrawal. Please try again.')),
  });
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: {
      product_id: string;
      account_name: string;
      opening_deposit: number;
      target_amount?: number;
      target_date?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('savings-ops', {
        body: { action: 'create', ...body, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['savings-accounts', institutionId] });
      toast.success(`Your savings goal "${variables.account_name}" is now active. Keep saving! 🎯`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not create your savings goal. Please try again.')),
  });
}

// ─── Loans ───
export function useLoanApplications() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['loan-applications', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      let query = supabase
        .from('loan_applications')
        .select('*, loan_product:loan_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as any;
      
      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useLoanProducts() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['loan-products', institutionId],
    queryFn: async () => {
      let query = supabase
        .from('loan_products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');
      
      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useApplyForLoan() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: {
      loan_product_id: string;
      requested_amount: number;
      tenure_months: number;
      purpose: string;
      submit?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('loan-ops', {
        body: { action: 'apply', ...body, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['loan-applications', institutionId] });
      toast.success(`Loan application for ${variables.requested_amount.toLocaleString()} XAF submitted. You'll be notified once reviewed.`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not submit loan application. Please check your details and try again.')),
  });
}

// ─── Credit Score ───
export function useCreditScore() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['credit-score', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, include_report: false, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ─── Virtual Cards ───
export function useVirtualCards() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['virtual-cards', institutionId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('virtual-cards', {
        body: { action: 'list', institution_id: institutionId },
      });
      if (error) throw error;
      return data?.cards || [];
    },
  });
}

export function useCreateVirtualCard() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { card_type?: string; currency?: string; spending_limit?: number }) => {
      const { data, error } = await supabase.functions.invoke('virtual-cards', {
        body: { action: 'create', ...body, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-cards', institutionId] });
      toast.success('Your new virtual card is ready to use for online payments 💳');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not create virtual card. Please try again later.')),
  });
}

export function useTopUpCard() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async ({ card_id, amount }: { card_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke('virtual-cards', {
        body: { action: 'topup', card_id, amount, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-cards', institutionId] });
      toast.success(`${variables.amount.toLocaleString()} XAF added to your virtual card`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not top up your card. Please try again.')),
  });
}

export function useUpdateCardStatus() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async ({ card_id, status }: { card_id: string; status: string }) => {
      const { data, error } = await supabase.functions.invoke('virtual-cards', {
        body: { action: 'update-status', card_id, status, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['virtual-cards', institutionId] });
      const statusMsg = variables.status === 'frozen' ? 'Card frozen — no transactions will be processed' 
        : variables.status === 'active' ? 'Card reactivated and ready to use'
        : `Card status changed to ${variables.status}`;
      toast.success(statusMsg);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not update card status. Please try again.')),
  });
}

// ─── Transfers ───
export function useSendTransfer() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: {
      source_account_id: string;
      destination_account_id: string;
      amount: number;
      currency?: string;
      description?: string;
      identifier_type?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('api-transfers', {
        body: { ...body, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', institutionId] });
      toast.success(`${variables.amount.toLocaleString()} ${variables.currency || 'XAF'} sent successfully. Your balance has been updated.`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Transfer could not be completed. Please verify recipient details and try again.')),
  });
}

// ─── Mobile Money ───
export function useMobileMoneyCharge() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: {
      phone_number: string;
      amount: number;
      currency?: string;
      provider?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('mobile-money-charge', {
        body: { ...body, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', institutionId] });
      toast.success(`${variables.amount.toLocaleString()} XAF sent to ${variables.phone_number} via ${variables.provider === 'mtn' ? 'MTN MoMo' : variables.provider === 'orange' ? 'Orange Money' : 'Mobile Money'}`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Mobile Money transfer failed. Please check the number and try again.')),
  });
}

// ─── Beneficiaries (for Quick Send) ───
export function useBeneficiaries() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['beneficiaries', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Beneficiaries are linked via account_id; filter accounts by institution first
      let query = supabase
        .from('beneficiaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Export Statement ───
export function useExportStatement() {
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { format?: string; start_date?: string; end_date?: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-bank-statement', {
        body: { ...body, institution_id: institutionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success('Your bank statement is ready for download 📄'),
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not generate your statement. Please try again.')),
  });
}

// ─── Loan Repayment (Banking App) ───
export function useLoanRepayment() {
  const queryClient = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async ({ loan_account_id, amount, payment_method, notes }: { 
      loan_account_id: string; amount: number; payment_method?: string; notes?: string 
    }) => {
      const idempotencyKey = `loan-repay-${loan_account_id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const { data, error } = await supabase.functions.invoke('loan-ops', {
        headers: { 'Idempotency-Key': idempotencyKey },
        body: { action: 'repay', loan_account_id, amount, payment_method: payment_method || 'bank_transfer', notes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-applications', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['credit-score', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', institutionId] });
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Loan repayment could not be processed. Please try again.')),
  });
}

// ─── Credit Profile (Event-Sourced) ───
export function useCreditProfile() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['credit-profile', institutionId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('credit-profile-get', {});
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Credit Events ───
export function useCreditEvents(limit = 20) {
  return useQuery({
    queryKey: ['credit-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('credit-events-list', {
        body: { limit, offset: 0 },
      });
      if (error) throw error;
      return data?.events || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
