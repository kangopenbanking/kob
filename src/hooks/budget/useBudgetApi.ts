// Hooks for the Smart Budgeting feature — all reads go through the
// existing Supabase Edge Function namespace. Mutations always go through
// the budgeting-ops edge function (financial-safety mandate).
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

async function callFn<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`${FN}${path}`, {
    method: (init.method as any) || "GET",
    body: init.body ? JSON.parse(init.body as string) : undefined,
  });
  if (error) throw error;
  return data as T;
}

export function useBudget() {
  return useQuery({
    queryKey: ["budget", "current"],
    queryFn: () => callFn<{ budget: Budget | null; summary: BudgetSummary | null }>("/budgets/current"),
    staleTime: 60_000,
  });
}

export function useBudgetAlerts() {
  return useQuery({
    queryKey: ["budget", "alerts"],
    queryFn: () => callFn<{ alerts: BudgetAlert[] }>("/alerts"),
    refetchInterval: 5 * 60_000,
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
    queryFn: () => callFn<{ goals: SavingsGoal[] }>("/goals"),
  });
}

export function useGoalProgress(goalId: string | undefined) {
  return useQuery({
    queryKey: ["budget", "goals", goalId, "progress"],
    queryFn: () => callFn<GoalProgress>(`/goals/${goalId}/progress`),
    enabled: !!goalId,
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
    queryFn: () => callFn<BudgetInsight>(`/insights?lang=${lang}`),
    staleTime: 30 * 60_000,
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
    queryFn: () => callFn<{ schedules: NjangiSchedule[] }>("/njangi/schedule"),
  });
}

export function useMerchants() {
  return useQuery({
    queryKey: ["budget", "merchants"],
    queryFn: () => callFn<{ merchants: MerchantSpend[] }>("/analytics/merchants?period=this_month"),
  });
}

export function useMonthlyAnalytics() {
  return useQuery({
    queryKey: ["budget", "analytics", "monthly"],
    queryFn: () => callFn<{ months: MonthlySpend[] }>("/analytics/monthly?months=3"),
  });
}
