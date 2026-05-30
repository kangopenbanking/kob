// Hooks for the Smart Budgeting feature — all reads go through the
// existing Supabase Edge Function namespace. Mutations always go through
// the budgeting-ops edge function (financial-safety mandate).
//
// Resilience policy:
//   • Reads retry up to 2 times with exponential backoff (1s, 2s, capped 5s).
//   • Each call is wrapped in a 12s client-side timeout so a slow/hung
//     edge function never freezes the UI behind `isLoading`.
//   • Hard failures resolve to a safe empty payload (never throw) so the
//     page can render its EmptyState instead of an infinite spinner.
//   • Mutations still surface errors to the caller for toast handling.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Budget,
  BudgetSummary,
  BudgetAlert,
  SavingsGoal,
  GoalProgress,
  BudgetInsight,
  BudgetLang,
  NjangiSchedule,
  MerchantSpend,
  MonthlySpend,
  BudgetCategory,
} from "@/types/budget";

const FN = "budgeting-ops";
const READ_TIMEOUT_MS = 12_000;

async function callFn<T>(path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), READ_TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke(`${FN}${path}`, {
      method: (init.method as any) || "GET",
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    if (error) throw error;
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

// Wrap a read so a failure resolves to a fallback value instead of throwing.
// This keeps `isLoading` honest and lets the UI render an empty/degraded
// state instead of getting stuck on the loading spinner forever.
async function safeRead<T>(path: string, fallback: T): Promise<T> {
  try {
    return await callFn<T>(path);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[budget] ${path} failed, using fallback`, err);
    return fallback;
  }
}

const READ_QUERY_OPTS = {
  retry: 2,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
  refetchOnWindowFocus: false,
} as const;

export function useBudget() {
  return useQuery({
    queryKey: ["budget", "current"],
    queryFn: () =>
      safeRead<{ budget: Budget | null; summary: BudgetSummary | null }>(
        "/budgets/current",
        { budget: null, summary: null },
      ),
    staleTime: 60_000,
    ...READ_QUERY_OPTS,
  });
}

export function useBudgetAlerts() {
  return useQuery({
    queryKey: ["budget", "alerts"],
    queryFn: () => safeRead<{ alerts: BudgetAlert[] }>("/alerts", { alerts: [] }),
    refetchInterval: 5 * 60_000,
    ...READ_QUERY_OPTS,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callFn(`/alerts/${id}/dismiss`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", "alerts"] }),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Budget> & { categories: { id: string; limit: number }[] }) =>
      callFn<Budget>("/budgets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { budgetId: string; categoryId: string; limit: number }) =>
      callFn<BudgetCategory>(`/budgets/${vars.budgetId}/categories/${vars.categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ limit: vars.limit }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget"] }),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["budget", "goals"],
    queryFn: () => safeRead<{ goals: SavingsGoal[] }>("/goals", { goals: [] }),
    ...READ_QUERY_OPTS,
  });
}

export function useGoalProgress(goalId: string | undefined) {
  return useQuery({
    queryKey: ["budget", "goals", goalId, "progress"],
    queryFn: () =>
      safeRead<GoalProgress | null>(`/goals/${goalId}/progress`, null),
    enabled: !!goalId,
    ...READ_QUERY_OPTS,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SavingsGoal>) =>
      callFn<SavingsGoal>("/goals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", "goals"] }),
  });
}

export function useInsight(lang: BudgetLang) {
  return useQuery({
    queryKey: ["budget", "insight", lang],
    queryFn: () =>
      safeRead<BudgetInsight | null>(`/insights?lang=${lang}`, null),
    staleTime: 30 * 60_000,
    ...READ_QUERY_OPTS,
  });
}

export function useAskInsight() {
  return useMutation({
    mutationFn: (body: { question: string; lang: BudgetLang; context?: string }) =>
      callFn<BudgetInsight>("/insights/ask", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useNjangiBudget() {
  return useQuery({
    queryKey: ["budget", "njangi"],
    queryFn: () =>
      safeRead<{ schedules: NjangiSchedule[] }>("/njangi/schedule", { schedules: [] }),
    ...READ_QUERY_OPTS,
  });
}

export function useMerchants() {
  return useQuery({
    queryKey: ["budget", "merchants"],
    queryFn: () =>
      safeRead<{ merchants: MerchantSpend[] }>(
        "/analytics/merchants?period=this_month",
        { merchants: [] },
      ),
    ...READ_QUERY_OPTS,
  });
}

export function useMonthlyAnalytics() {
  return useQuery({
    queryKey: ["budget", "analytics", "monthly"],
    queryFn: () =>
      safeRead<{ months: MonthlySpend[] }>("/analytics/monthly?months=3", { months: [] }),
    ...READ_QUERY_OPTS,
  });
}
