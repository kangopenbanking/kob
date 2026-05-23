// Hooks for the independent Saving Vault (round-up balance).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FN = "vault-ops";

async function call<T>(path: string, init: { method?: "GET" | "POST" | "PATCH"; body?: any } = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`${FN}${path}`, {
    method: init.method ?? "GET",
    body: init.body,
  });
  if (error) throw error;
  return data as T;
}

export interface VaultBalance {
  balance: number;
  currency: string;
  daily_withdrawal_limit: number;
  monthly_withdrawal_limit: number;
}

export interface VaultLimits {
  daily_withdrawal_limit: number;
  monthly_withdrawal_limit: number;
  used_today: number;
  used_this_month: number;
  remaining_today: number;
  remaining_this_month: number;
  currency: string;
}

export interface VaultTransaction {
  id: string;
  kind: "credit" | "debit";
  amount: number;
  balance_after: number;
  source: string | null;
  source_ref: string | null;
  destination_kind: "wallet" | "bank" | null;
  destination_account_id: string | null;
  description: string | null;
  reference_code: string | null;
  created_at: string;
}

export interface WithdrawResult {
  transaction: VaultTransaction;
  new_balance: number;
  reference_code: string;
  destination: { kind: "wallet" | "bank"; account_id: string; label: string };
  replayed?: boolean;
}

export interface VaultStatement {
  generated_at: string;
  consumer_id: string;
  currency: string;
  balance: number;
  transactions: VaultTransaction[];
}

export function useVaultBalance() {
  return useQuery({
    queryKey: ["vault", "balance"],
    queryFn: () => call<VaultBalance>("/balance"),
    staleTime: 15_000,
  });
}

export function useVaultLimits() {
  return useQuery({
    queryKey: ["vault", "limits"],
    queryFn: () => call<VaultLimits>("/limits"),
    staleTime: 15_000,
  });
}

export function useUpdateVaultLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { daily_withdrawal_limit?: number; monthly_withdrawal_limit?: number }) =>
      call<{ daily_withdrawal_limit: number; monthly_withdrawal_limit: number; currency: string }>("/limits", {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["vault"] });
    },
  });
}

export function useVaultTransactions(limit = 50) {
  return useQuery({
    queryKey: ["vault", "transactions", limit],
    queryFn: () => call<{ transactions: VaultTransaction[] }>(`/transactions?limit=${limit}`),
  });
}

export function useVaultStatement() {
  return useMutation({
    mutationFn: (params: { from?: string; to?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      const suffix = q.toString() ? `?${q.toString()}` : "";
      return call<VaultStatement>(`/statement${suffix}`);
    },
  });
}

export function useWithdrawVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      amount: number;
      destination_kind: "wallet" | "bank";
      destination_account_id: string;
      idempotency_key?: string;
    }) =>
      call<WithdrawResult>("/withdraw", {
        method: "POST",
        body: { idempotency_key: crypto.randomUUID(), ...body },
      }),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["vault"] });
      qc.refetchQueries({ queryKey: ["customer-accounts"] });
      qc.refetchQueries({ queryKey: ["account-balances"] });
      qc.refetchQueries({ queryKey: ["notifications"] });
    },
  });
}
