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
      toast.success('Your PiggyBank savings plan is now active! 🐷 Keep saving consistently.');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not create your savings plan. Please try again.')),
  });
}

// ─── Pay ───
export function usePiggyBankPay() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { payment_id: string }) => {
      const idempotencyKey = `piggy_pay_${body.payment_id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: { action: 'pay', ...body, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piggybank-plans', institutionId] });
      qc.invalidateQueries({ queryKey: ['credit-score'] });
      toast.success('Installment paid! You\'re one step closer to your savings goal. 🎉');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Payment could not be processed. Please ensure you have sufficient funds.')),
  });
}
