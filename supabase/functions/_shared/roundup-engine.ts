// Pure round-up calculation engine. Unit testable, no I/O.

export const ALLOWED_THRESHOLDS = [10, 50, 100, 500, 1000] as const;
export type Threshold = (typeof ALLOWED_THRESHOLDS)[number];

export interface RoundUpInput {
  amount: number;
  threshold: number;
  minSave: number;
  maxSave: number;
}

/**
 * rounded = ceil(amount/threshold)*threshold; roundUp = rounded - amount.
 * Returns 0 when amount/threshold invalid, roundUp <= 0, or roundUp < minSave.
 * Clamps to maxSave.
 */
export function calculateRoundUp(input: RoundUpInput): number {
  const { amount, threshold, minSave, maxSave } = input;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!ALLOWED_THRESHOLDS.includes(threshold as Threshold)) return 0;
  if (!Number.isFinite(maxSave) || maxSave < 0) return 0;

  const rounded = Math.ceil(amount / threshold) * threshold;
  let roundUp = rounded - amount;
  if (roundUp <= 0) return 0;
  if (roundUp < minSave) return 0;
  if (roundUp > maxSave) roundUp = maxSave;
  return Math.round(roundUp);
}

export type SkipReason =
  | "below_min"
  | "low_balance"
  | "daily_cap"
  | "paused"
  | "disabled"
  | null;

export interface ClassifyCtx {
  enabled: boolean;
  pausedUntil: string | null;
  roundUpAmount: number;
  minSave: number;
  walletBalance: number;
  minBalanceFloor: number;
  todaysSavedTotal: number;
  dailyCap: number;
}

export function classifySkip(ctx: ClassifyCtx): SkipReason {
  if (!ctx.enabled) return "disabled";
  if (ctx.pausedUntil && new Date(ctx.pausedUntil).getTime() > Date.now()) return "paused";
  if (ctx.roundUpAmount < ctx.minSave) return "below_min";
  if (ctx.walletBalance - ctx.roundUpAmount < ctx.minBalanceFloor) return "low_balance";
  if (ctx.todaysSavedTotal + ctx.roundUpAmount > ctx.dailyCap) return "daily_cap";
  return null;
}

/** Retry backoff: +1h, +24h, then pause. */
export function nextRetry(retryCount: number): { nextAt: string | null; pause: boolean } {
  const now = Date.now();
  if (retryCount === 0) return { nextAt: new Date(now + 60 * 60 * 1000).toISOString(), pause: false };
  if (retryCount === 1) return { nextAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(), pause: false };
  return { nextAt: null, pause: true };
}
