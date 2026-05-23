// Hooks for the Round-Up Savings engine. All mutations go through the
// budgeting-ops edge function (financial-safety mandate).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FN = "budgeting-ops";

async function callFn<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`${FN}${path}`, {
    method: (init.method as any) || "GET",
    body: init.body ? JSON.parse(init.body as string) : undefined,
  });
  if (error) throw error;
  return data as T;
}

export interface RoundupSettings {
  consumer_id: string;
  enabled: boolean;
  threshold: 10 | 50 | 100 | 500 | 1000;
  min_save: number;
  max_save: number;
  daily_cap: number;
  min_balance_floor: number;
  default_goal_id: string | null;
  paused_until: string | null;
  consecutive_failures: number;
}

export interface RoundupTransaction {
  id: string;
  source_tx_id: string;
  goal_id: string | null;
  original_amount: number;
  rounded_amount: number;
  roundup_amount: number;
  threshold_used: number;
  state: "pending" | "processing" | "successful" | "failed" | "reversed" | "skipped";
  skip_reason: string | null;
  retry_count: number;
  created_at: string;
}

export function useRoundupSettings() {
  return useQuery({
    queryKey: ["roundup", "settings"],
    queryFn: () => callFn<{ settings: RoundupSettings }>("/roundup/settings"),
    staleTime: 60_000,
  });
}

export function useUpdateRoundupSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<RoundupSettings>) =>
      callFn<{ settings: RoundupSettings }>("/roundup/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.refetchQueries({ queryKey: ["roundup"] }),
  });
}

export function useRoundupTransactions(limit = 25) {
  return useQuery({
    queryKey: ["roundup", "transactions", limit],
    queryFn: () =>
      callFn<{ transactions: RoundupTransaction[]; saved_this_month: number }>(
        `/roundup/transactions?limit=${limit}`,
      ),
    staleTime: 30_000,
  });
}

export function usePreviewRoundup() {
  return useMutation({
    mutationFn: (body: { amount: number; threshold?: number }) =>
      callFn<{
        original_amount: number;
        rounded_amount: number;
        roundup_amount: number;
        threshold_used: number;
      }>("/roundup/preview", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function usePauseRoundup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pause: boolean) =>
      callFn(`/roundup/${pause ? "pause" : "resume"}`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.refetchQueries({ queryKey: ["roundup"] }),
  });
}
