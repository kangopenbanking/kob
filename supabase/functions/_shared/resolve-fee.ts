// =============================================================
// resolve-fee.ts — Unified admin-managed fee resolver.
// Every edge function that charges a fee MUST resolve it through
// this helper so that changes made in /admin/fee-management are
// applied live in the module (no per-module hard-coded rates).
//
// Priority:
//   1. RPC `calculate_transaction_fee` (institution → platform, waivers)
//   2. Direct `fee_structures` read (fallback if RPC unavailable)
//   3. Provided static fallback (last resort, keeps flows non-fatal)
// =============================================================

export interface FeeQuote {
  final_fee: number;
  fee_model: string | null;
  percentage_rate: number;
  fixed_amount: number;
  source: "rpc" | "table" | "fallback";
  reason?: string;
}

export interface FeeFallback {
  fixed_amount?: number;
  percentage_rate?: number; // as percent (e.g. 1.5 = 1.5%)
  min?: number;
  max?: number | null;
}

/**
 * Resolve a fee for a given transaction type and amount using the unified
 * admin-managed pipeline.
 */
export async function resolveFee(
  sb: any,
  args: {
    transaction_type: string;
    amount: number;
    institution_id?: string | null;
    transaction_date?: string; // YYYY-MM-DD
    fallback?: FeeFallback;
  },
): Promise<FeeQuote> {
  const fallback = args.fallback ?? {};
  const amount = Number(args.amount) || 0;
  const today = args.transaction_date ?? new Date().toISOString().slice(0, 10);

  // 1. Preferred: canonical RPC (handles waivers, tiers, institution overrides)
  try {
    const { data, error } = await sb.rpc("calculate_transaction_fee", {
      _institution_id: args.institution_id ?? null,
      _transaction_type: args.transaction_type,
      _transaction_amount: amount,
      _transaction_date: today,
    });
    if (!error && data && data.reason !== "no_active_structure") {
      return {
        final_fee: Number(data.final_fee ?? 0),
        fee_model: data.fee_model ?? null,
        percentage_rate: Number(data.percentage_rate ?? 0),
        fixed_amount: Number(data.fixed_component ?? 0),
        source: "rpc",
      };
    }
  } catch (_) { /* fall through */ }

  // 2. Direct table read (platform scope)
  try {
    const { data: row } = await sb
      .from("fee_structures")
      .select("fee_model, fixed_amount, percentage_rate, min_fee_amount, max_fee_amount")
      .eq("transaction_type", args.transaction_type)
      .eq("fee_scope", "platform")
      .eq("is_active", true)
      .lte("effective_from", today)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) {
      const fee = computeFromRow(row, amount);
      return {
        final_fee: fee,
        fee_model: row.fee_model,
        percentage_rate: Number(row.percentage_rate ?? 0),
        fixed_amount: Number(row.fixed_amount ?? 0),
        source: "table",
      };
    }
  } catch (_) { /* fall through */ }

  // 3. Static fallback
  const pct = Number(fallback.percentage_rate ?? 0);
  const fixed = Number(fallback.fixed_amount ?? 0);
  let out = fixed + (amount * pct) / 100;
  if (fallback.min != null && out < fallback.min) out = fallback.min;
  if (fallback.max != null && out > fallback.max) out = fallback.max;
  return {
    final_fee: Math.max(0, Math.round(out * 100) / 100),
    fee_model: "fallback",
    percentage_rate: pct,
    fixed_amount: fixed,
    source: "fallback",
    reason: "no_active_structure",
  };
}

function computeFromRow(row: any, amount: number): number {
  const model = String(row.fee_model ?? "fixed");
  const fixed = Number(row.fixed_amount ?? 0);
  const pct = Number(row.percentage_rate ?? 0);
  const min = Number(row.min_fee_amount ?? 0);
  const max = row.max_fee_amount == null ? null : Number(row.max_fee_amount);
  let out = 0;
  if (model === "fixed") out = fixed;
  else if (model === "percentage") out = amount * (pct / 100);
  else if (model === "hybrid") out = fixed + amount * (pct / 100);
  else out = fixed + amount * (pct / 100);
  if (min && out < min) out = min;
  if (max != null && out > max) out = max;
  return Math.max(0, Math.round(out * 100) / 100);
}
