// Shared FX + fee math for Nium incoming payments.
// Used by both nium-webhook (settlement) and nium-quote-payout (preview).
// Must stay in lockstep — any divergence breaks "Transaction Preview" parity.

import { getFxQuote, type NiumCurrency } from "./nium-client.ts";

export type Routing = "KANG_WALLET" | "MOBILE_MONEY";

export interface FxBreakdown {
  source_amount: number;
  source_currency: NiumCurrency;
  fx_rate_nium: number;
  fx_spread_bps: number;
  xaf_gross: number;
  xaf_spread_revenue: number;
  xaf_after_spread: number;
  xaf_withdrawal_fee: number;
  xaf_net_credited: number;
  routing: Routing;
}

interface FeeRow {
  fixed_amount?: number | string | null;
  percentage_rate?: number | string | null;
  min_fee_amount?: number | string | null;
  max_fee_amount?: number | string | null;
}

export async function loadSpreadBps(svc: any): Promise<number> {
  const { data } = await svc
    .from("fee_structures")
    .select("percentage_rate")
    .eq("transaction_type", "nium_fx_spread")
    .eq("fee_scope", "platform")
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Math.round((Number(data?.percentage_rate ?? 0.0075)) * 10000);
}

export async function loadMomoFeeRow(svc: any): Promise<FeeRow | null> {
  const { data } = await svc
    .from("fee_structures")
    .select("fixed_amount, percentage_rate, min_fee_amount, max_fee_amount")
    .eq("transaction_type", "nium_withdrawal")
    .eq("fee_scope", "platform")
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export function computeMomoFee(xafAfterSpread: number, feeRow: FeeRow | null): number {
  const fixed = Number(feeRow?.fixed_amount ?? 100);
  const pct = Number(feeRow?.percentage_rate ?? 0.01);
  const min = Number(feeRow?.min_fee_amount ?? 200);
  const max = feeRow?.max_fee_amount != null ? Number(feeRow.max_fee_amount) : null;
  let computed = Math.round(fixed + xafAfterSpread * pct);
  computed = Math.max(min, computed);
  if (max && computed > max) computed = max;
  return Math.min(computed, Math.max(0, xafAfterSpread - 1));
}

export async function quoteBreakdown(
  svc: any,
  params: { source_amount: number; source_currency: NiumCurrency; routing: Routing },
): Promise<FxBreakdown> {
  const spreadBps = await loadSpreadBps(svc);
  const quote = await getFxQuote(params.source_currency, params.source_amount);
  const xafGross = Math.round(params.source_amount * quote.rate);
  const xafSpreadRevenue = Math.round((xafGross * spreadBps) / 10000);
  const xafAfterSpread = xafGross - xafSpreadRevenue;

  let xafFee = 0;
  if (params.routing === "MOBILE_MONEY") {
    const feeRow = await loadMomoFeeRow(svc);
    xafFee = computeMomoFee(xafAfterSpread, feeRow);
  }
  const xafNet = Math.max(0, xafAfterSpread - xafFee);

  return {
    source_amount: params.source_amount,
    source_currency: params.source_currency,
    fx_rate_nium: quote.rate,
    fx_spread_bps: spreadBps,
    xaf_gross: xafGross,
    xaf_spread_revenue: xafSpreadRevenue,
    xaf_after_spread: xafAfterSpread,
    xaf_withdrawal_fee: xafFee,
    xaf_net_credited: xafNet,
    routing: params.routing,
  };
}
