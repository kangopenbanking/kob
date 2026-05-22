// Smart Budgeting — shared TypeScript types
// Source of truth mirrors public/openapi.json /v1/budgeting/* schemas.

export type BudgetLang = "en" | "fr" | "pid";
export type BudgetPeriod = "monthly" | "weekly" | "custom";
export type BudgetStatus = "active" | "paused" | "archived";
export type GoalStatus = "active" | "completed" | "paused";

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  colour: string;
  limit: number;
  spent: number;
  remaining?: number;
  percentage_used?: number;
  transaction_count?: number;
  top_merchant?: string | null;
}

export interface Budget {
  id: string;
  consumer_id: string;
  name: string;
  period: BudgetPeriod;
  start_date: string;
  end_date: string;
  total_limit: number;
  categories: BudgetCategory[];
  currency: "XAF";
  status: BudgetStatus;
  created_at: string;
  updated_at?: string;
}

export interface BudgetSummary {
  budget_id: string;
  period_start: string;
  period_end: string;
  total_limit: number;
  total_spent: number;
  total_remaining: number;
  percentage_used: number;
  days_remaining: number;
  projected_overspend: boolean;
  projected_end_balance: number;
  categories: BudgetCategory[];
  currency: "XAF";
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  icon: string;
  colour: string;
  round_up_enabled: boolean;
  round_up_nearest?: 500 | 1000 | 2000 | null;
  linked_piggy_bank_id?: string | null;
  status: GoalStatus;
  created_at: string;
}

export interface GoalProgress {
  goal_id: string;
  percentage_complete: number;
  amount_remaining: number;
  projected_completion_date?: string;
  weekly_required: number;
  on_track: boolean;
  milestones_reached: number[];
  next_milestone?: number | null;
  round_up_total_this_month: number;
}

export interface NjangiSchedule {
  group_id: string;
  group_name: string;
  next_contribution_date: string;
  next_contribution_amount: number;
  days_until_due: number;
  budget_impact_xaf: number;
  reminder_enabled: boolean;
}

export interface BudgetInsight {
  answer: string;
  lang: BudgetLang;
  confidence: number;
  suggested_action?: {
    type: "update_category_limit" | "create_goal" | "pause_category" | "enable_roundup";
    category_id?: string;
    suggested_limit?: number;
  } | null;
  generated_at: string;
}

export type BudgetAlertType =
  | "budget.threshold_reached"
  | "budget.overspent"
  | "goal.milestone_reached"
  | "njangi.contribution_due"
  | "budget.unusual_transaction";

export interface BudgetAlert {
  id: string;
  type: BudgetAlertType;
  severity: "info" | "warning" | "critical";
  message: string;
  category_id?: string | null;
  created_at: string;
  dismissed: boolean;
}

export interface MerchantSpend {
  name: string;
  category_id: string;
  total_spent: number;
  transaction_count: number;
}

export interface MonthlySpend {
  month: string;
  total_spent: number;
  by_category: Record<string, number>;
}
