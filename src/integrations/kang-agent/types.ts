// Kang Agent — AI Financial Advisor
// TypeScript interfaces mirroring the public schema tables backing this module.
// These are hand-written companions to the auto-generated Supabase types and
// are intentionally scoped to the Kang Agent surface area.

export type KangChatRole = "user" | "assistant";

export type KangSubscriptionStatus = "trial" | "active" | "suspended";

export type KangSubscriptionPaymentStatus = "none" | "success" | "failed";

/** public.kang_chat_sessions */
export interface KangChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type KangChatSessionInsert = {
  id?: string;
  user_id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
};

export type KangChatSessionUpdate = Partial<KangChatSessionInsert>;

/** public.kang_messages */
export interface KangMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: KangChatRole;
  content: string;
  created_at: string;
}

export type KangMessageInsert = {
  id?: string;
  session_id: string;
  user_id: string;
  role: KangChatRole;
  content: string;
  created_at?: string;
};

export type KangMessageUpdate = Partial<KangMessageInsert>;

/** public.kang_subscriptions */
export interface KangSubscription {
  id: string;
  user_id: string;
  status: KangSubscriptionStatus;
  questions_asked_count: number;
  free_questions_limit: number;
  current_period_start: string | null;
  current_period_end: string | null;
  last_payment_status: KangSubscriptionPaymentStatus;
  created_at: string;
  updated_at: string;
}

export type KangSubscriptionInsert = {
  id?: string;
  user_id: string;
  status?: KangSubscriptionStatus;
  questions_asked_count?: number;
  free_questions_limit?: number;
  current_period_start?: string | null;
  current_period_end?: string | null;
  last_payment_status?: KangSubscriptionPaymentStatus;
  created_at?: string;
  updated_at?: string;
};

export type KangSubscriptionUpdate = Partial<KangSubscriptionInsert>;

/** public.credit_score_ledger */
export interface CreditScoreLedgerEntry {
  id: string;
  user_id: string;
  /** +1 for on-time monthly payment, -3 for missed monthly payment. */
  points_change: number;
  reason: string;
  created_at: string;
}

export type CreditScoreLedgerInsert = {
  id?: string;
  user_id: string;
  points_change: number;
  reason: string;
  created_at?: string;
};
