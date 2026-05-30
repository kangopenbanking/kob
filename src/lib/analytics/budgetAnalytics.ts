/**
 * Lightweight analytics shim for the Budget page.
 *
 * - Always logs through the project logger (production-safe).
 * - Dispatches a window CustomEvent so tests and any future analytics
 *   provider can observe events without coupling to a vendor SDK.
 */
import { logger } from "@/lib/logger";

export type BudgetAnalyticsEvent =
  | "budget.mini_donut.tap"
  | "budget.stat_sheet.open"
  | "budget.stat_sheet.close";

export interface BudgetAnalyticsPayload {
  stat?: "left" | "daily" | "days";
  percent?: number;
  value?: number | string;
  source?: string;
  [key: string]: unknown;
}

export function trackBudgetEvent(
  event: BudgetAnalyticsEvent,
  payload: BudgetAnalyticsPayload = {},
): void {
  const detail = { event, ts: Date.now(), ...payload };
  logger.info(`[analytics] ${event}`, detail);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("kob:analytics", { detail }));
    } catch {
      /* noop — CustomEvent unsupported (very old envs) */
    }
  }
}
