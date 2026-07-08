import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Linked Institutions ───
export function useLinkedInstitutions(userId?: string) {
  return useQuery({
    queryKey: ['linked-institutions', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('customer_linked_accounts') as any)
        .select('id, institution_id, account_type, status, linked_at')
        .eq('user_id', userId!)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Accounts & Balances (multi-institution) ───
export function useCustomerAccounts(userId?: string, institutionId?: string) {
  return useQuery({
    queryKey: ['customer-accounts', userId, institutionId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('id, account_holder_name, account_id, account_type, account_subtype, currency, nickname, is_active, institution_id')
        .eq('user_id', userId!)
        .eq('is_active', true);
      if (institutionId) query = query.eq('institution_id', institutionId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAccountBalances(accountIds: string[]) {
  return useQuery({
    queryKey: ['account-balances', accountIds],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_balances')
        .select('id, account_id, amount, currency, balance_type, credit_debit_indicator, balance_datetime')
        .in('account_id', accountIds)
        .in('balance_type', ['ClosingAvailable', 'InterimAvailable']);
      if (error) throw error;

      // Pick ClosingAvailable per account (preferred), fallback to InterimAvailable.
      // This ensures UI matches the balance the transfer edge function checks.
      const byAccount = new Map<string, any>();
      for (const row of (data || [])) {
        const existing = byAccount.get(row.account_id);
        if (!existing) {
          byAccount.set(row.account_id, row);
          continue;
        }
        // Prefer ClosingAvailable over InterimAvailable
        if (row.balance_type === 'ClosingAvailable' && existing.balance_type !== 'ClosingAvailable') {
          byAccount.set(row.account_id, row);
        } else if (row.balance_type === existing.balance_type) {
          // Same type: pick the most recently updated one
          const rowTime = new Date(row.balance_datetime || 0).getTime();
          const exTime = new Date(existing.balance_datetime || 0).getTime();
          if (rowTime > exTime) byAccount.set(row.account_id, row);
        }
      }

      return Array.from(byAccount.values());
    },
  });
}

// ─── Transactions (multi-institution) ───
export function useCustomerTransactions(userId?: string, institutionId?: string, limit = 20) {
  return useQuery({
    queryKey: ['customer-transactions', userId, institutionId, limit],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('id, amount, currency, credit_debit_indicator, transaction_type, transaction_information, booking_datetime, status, merchant_details, metadata')
        .eq('user_id', userId!)
        .order('booking_datetime', { ascending: false })
        .limit(limit);
      if (institutionId) query = query.eq('institution_id', institutionId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Virtual Cards ───
export function useCustomerCards(userId?: string) {
  return useQuery({
    queryKey: ['customer-cards', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('id, card_name, last4, brand, exp_month, exp_year, status, balance_usd, spending_controls')
        .eq('user_id', userId!);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCardTransactions(userId?: string, limit = 10) {
  return useQuery({
    queryKey: ['card-transactions', userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_payment_transactions')
        .select('id, amount, currency, description, status, card_last4, created_at, transaction_type')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Savings / Piggy Bank ───
export function useCustomerSavings(userId?: string, institutionId?: string) {
  return useQuery({
    queryKey: ['customer-savings', userId, institutionId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('savings_accounts')
        .select('id, account_name, current_balance, target_amount, savings_type, status, target_date')
        .eq('user_id', userId!)
        .eq('status', 'active') as any;
      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Njangi Groups ───
export function useCustomerNjangi(userId?: string, institutionId?: string) {
  return useQuery({
    queryKey: ['customer-njangi', userId, institutionId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: memberships, error: memberErr } = await supabase
        .from('njangi_members')
        .select('id, group_id, status')
        .eq('user_id', userId!)
        .eq('status', 'active');
      if (memberErr) throw memberErr;
      if (!memberships || memberships.length === 0) return [];

      const groupIds = memberships.map(m => m.group_id);
      const { data: groups, error: groupErr } = await supabase
        .from('njangi_groups')
        .select('id, name, contribution_amount, frequency, max_members, current_cycle, status, created_at')
        .in('id', groupIds);
      if (groupErr) throw groupErr;

      const results = await Promise.all((groups || []).map(async (g) => {
        const { count } = await supabase
          .from('njangi_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', g.id)
          .eq('status', 'active');
        return { ...g, member_count: count || 0 };
      }));
      return results;
    },
  });
}

// ─── Credit Score (unified via edge function) ───
export function useCustomerCreditScore(userId?: string) {
  return useQuery({
    queryKey: ['customer-credit-score', userId],
    enabled: !!userId,
    refetchOnWindowFocus: true,
    // Auto-refresh every 15s while the customer is still gated by the basic
    // check so a Didit webhook approval (or any other async unlock) is
    // reflected without requiring a manual reload.
    refetchInterval: (query) => {
      const d: any = query.state.data;
      if (d?.source === 'basic_check_required') return 15_000;
      return false;
    },
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: userId, include_report: false },
      });
      if (error) throw error;

      // Basic-check gate: customer has no score until the basic identity
      // check is complete. Surface the checklist so the UI can prompt the user.
      if (data?.source === 'basic_check_required' || (!data?.score && data?.basic_check)) {
        return {
          score: null,
          score_band: null,
          updated_at: null,
          score_factors: null,
          payment_history_score: 0,
          amounts_owed_score: 0,
          credit_history_length_score: 0,
          new_credit_score: 0,
          credit_mix_score: 0,
          source: 'basic_check_required' as string,
          basic_check: data.basic_check,
        };
      }

      if (!data?.score) return null;

      // Handle both legacy (nested components) and event-sourced (flat factors array) responses
      const components = data.score_factors?.components || {};
      const factorsArr = Array.isArray(data.score_factors) ? data.score_factors : [];

      // For event-sourced: derive factor-like scores from factor impacts
      const getFactorFromArray = (keywords: string[]) => {
        const match = factorsArr.find((f: any) => keywords.some(k => f.event_type?.includes(k)));
        // Normalize to 0-100 scale: positive impact = higher score
        return match ? Math.max(0, Math.min(100, 50 + match.total_impact)) : 0;
      };

      return {
        score: data.score,
        score_band: data.score_range,
        updated_at: data.calculated_at,
        score_factors: data.score_factors,
        payment_history_score: components.payment_history_score ?? components.payment_history?.score ?? getFactorFromArray(['LOAN_REPAYMENT', 'LOAN_INSTALLMENT']),
        amounts_owed_score: components.amounts_owed_score ?? components.amounts_owed?.score ?? getFactorFromArray(['LOAN_DEFAULTED']),
        credit_history_length_score: components.credit_history_length_score ?? components.credit_history?.score ?? getFactorFromArray(['LOAN_CLOSED']),
        new_credit_score: components.new_credit_score ?? components.new_credit?.score ?? getFactorFromArray(['HARD_INQUIRY']),
        credit_mix_score: components.credit_mix_score ?? components.credit_mix?.score ?? getFactorFromArray(['SAVINGS', 'NJANGI', 'PIGGYBANK', 'RENT']),
        source: (data.source || 'edge_function') as string,
        basic_check: undefined,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Profile for QR / Receive ───
export function useCustomerProfile(userId?: string) {
  return useQuery({
    queryKey: ['customer-profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, email, linked_account_number, linked_account_name, linked_account_type')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Bill Payments (multi-institution) ───
export function useRecentBillPayments(userId?: string, institutionId?: string) {
  return useQuery({
    queryKey: ['customer-bill-payments', userId, institutionId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('id, amount, currency, transaction_information, booking_datetime, status, metadata')
        .eq('user_id', userId!)
        .eq('transaction_type', 'bill_payment')
        .order('booking_datetime', { ascending: false })
        .limit(10);
      if (institutionId) query = query.eq('institution_id', institutionId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Spending Summary (multi-institution) ───
export function useSpendingSummary(userId?: string, institutionId?: string, period: 'W' | 'M' | 'Y' = 'M') {
  return useQuery({
    queryKey: ['spending-summary', userId, institutionId, period],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      let from: Date;
      if (period === 'W') {
        from = new Date(now);
        from.setDate(from.getDate() - 7);
      } else if (period === 'M') {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        from = new Date(now.getFullYear(), 0, 1);
      }

      let query = supabase
        .from('transactions')
        .select('amount, credit_debit_indicator')
        .eq('user_id', userId!)
        .gte('booking_datetime', from.toISOString())
        .eq('status', 'Booked');
      if (institutionId) query = query.eq('institution_id', institutionId);
      const { data, error } = await query;
      if (error) throw error;

      let earnings = 0;
      let spending = 0;
      (data || []).forEach((tx: any) => {
        const amt = Math.abs(tx.amount || 0);
        if (tx.credit_debit_indicator === 'Credit') earnings += amt;
        else spending += amt;
      });
      return { earnings, spending };
    },
  });
}

// ─── Delete Transaction ───
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
    },
  });
}
