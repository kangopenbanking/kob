import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

function useInstitutionId() {
  const { institutionId } = useParams();
  return institutionId;
}

// ─── Piggy Bank Plans ───
export function usePiggyBankPlans() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['piggybank-plans', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('piggybank_plans')
        .select('*, piggybank_payments(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (institutionId) query = query.eq('institution_id', institutionId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Piggy Bank Payments ───
export function usePiggyBankPayments(planId: string) {
  return useQuery({
    queryKey: ['piggybank-payments', planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('piggybank_payments')
        .select('*')
        .eq('plan_id', planId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── User Accounts (for auto-fund source selection) ───
export function useUserAccounts() {
  return useQuery({
    queryKey: ['customer-accounts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_holder_name, nickname, currency, account_balances(amount, balance_type, credit_debit_indicator)')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((a: any) => {
        const closingBal = (a.account_balances || []).find(
          (b: any) => b.balance_type === 'ClosingAvailable' && b.credit_debit_indicator === 'Credit'
        );
        return { ...a, available_balance: closingBal?.amount || 0 };
      });
    },
  });
}

// ─── Create Plan ───
export function useCreatePiggyBankPlan() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: { action: 'create', ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piggybank-plans', institutionId] });
      toast.success('Your PiggyBank savings plan is now active! Keep saving consistently.');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not create your savings plan. Please try again.')),
  });
}

// ─── Pay ───
export function usePiggyBankPay() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { payment_id: string; fund_from_wallet?: boolean; account_id?: string }) => {
      const idempotencyKey = `piggy_pay_${body.payment_id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: { action: 'pay', ...body, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['piggybank-plans', institutionId] });
      qc.invalidateQueries({ queryKey: ['credit-score'] });
      qc.invalidateQueries({ queryKey: ['customer-credit-score'] });
      qc.invalidateQueries({ queryKey: ['customer-accounts'] });
      qc.invalidateQueries({ queryKey: ['account-balances'] });
      const walletMsg = data?.wallet_debited ? ' Funds debited from your wallet.' : '';
      toast.success(`Installment paid! You're one step closer to your savings goal.${walletMsg}`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Payment could not be processed. Please ensure you have sufficient funds.')),
  });
}

// ─── Cancel Plan ───
export function useCancelPiggyBankPlan() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { plan_id: string }) => {
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: { action: 'cancel', ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['piggybank-plans', institutionId] });
      qc.invalidateQueries({ queryKey: ['credit-score'] });
      qc.invalidateQueries({ queryKey: ['customer-credit-score'] });
      toast.success(`Plan cancelled. Your credit score was impacted by ${data?.credit_impact || -5} points.`);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not cancel the plan.')),
  });
}

// ─── Delete Personal Plan (no credit impact) ───
export function useDeletePiggyBankPlan() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { plan_id: string }) => {
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: { action: 'delete', ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piggybank-plans', institutionId] });
      toast.success('Personal savings plan deleted.');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not delete the plan.')),
  });
}
