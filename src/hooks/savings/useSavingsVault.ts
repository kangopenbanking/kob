// Hooks for the independent Saving Vault (round-up balance).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FN = "vault-ops";

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: any } = {}): Promise<T> {
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
  created_at: string;
}

export function useVaultBalance() {
  return useQuery({
    queryKey: ["vault", "balance"],
    queryFn: () => call<VaultBalance>("/balance"),
    staleTime: 15_000,
  });
}

export function useVaultTransactions(limit = 50) {
  return useQuery({
    queryKey: ["vault", "transactions", limit],
    queryFn: () => call<{ transactions: VaultTransaction[] }>(`/transactions?limit=${limit}`),
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
      call<{ transaction: VaultTransaction; new_balance: number }>("/withdraw", {
        method: "POST",
        body: { idempotency_key: crypto.randomUUID(), ...body },
      }),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["vault"] });
      qc.refetchQueries({ queryKey: ["customer-accounts"] });
      qc.refetchQueries({ queryKey: ["account-balances"] });
    },
  });
}
