// =============================================================
// card-fees.ts — Admin-managed card fee resolution + wallet debit.
// Reads platform-scope rows from `fee_structures` for:
//   - card_issuance_fee   (fixed / one-off on issue)
//   - card_maintenance_fee (fixed / monthly cron)
//   - card_transaction_fee (percentage or hybrid per fund/spend)
// =============================================================

export type CardFeeType =
  | "card_issuance_fee"
  | "card_maintenance_fee"
  | "card_transaction_fee";

export interface ResolvedFee {
  transaction_type: CardFeeType;
  fee_model: "fixed" | "percentage" | "hybrid" | "tiered";
  fixed_amount: number;
  percentage_rate: number; // decimal (0.015 = 1.5%)
  min_fee_amount: number;
  max_fee_amount: number | null;
}

const FALLBACK: Record<CardFeeType, ResolvedFee> = {
  card_issuance_fee:    { transaction_type: "card_issuance_fee",    fee_model: "fixed",      fixed_amount: 2500, percentage_rate: 0,      min_fee_amount: 0, max_fee_amount: null },
  card_maintenance_fee: { transaction_type: "card_maintenance_fee", fee_model: "fixed",      fixed_amount: 500,  percentage_rate: 0,      min_fee_amount: 0, max_fee_amount: null },
  card_transaction_fee: { transaction_type: "card_transaction_fee", fee_model: "percentage", fixed_amount: 0,    percentage_rate: 0.015,  min_fee_amount: 0, max_fee_amount: null },
};

export async function resolveCardFee(sb: any, type: CardFeeType): Promise<ResolvedFee> {
  const { data } = await sb
    .from("fee_structures")
    .select("transaction_type,fee_model,fixed_amount,percentage_rate,min_fee_amount,max_fee_amount")
    .eq("transaction_type", type)
    .eq("fee_scope", "platform")
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return FALLBACK[type];
  return {
    transaction_type: type,
    fee_model: (data.fee_model ?? "fixed") as ResolvedFee["fee_model"],
    fixed_amount: Number(data.fixed_amount ?? 0),
    percentage_rate: Number(data.percentage_rate ?? 0),
    min_fee_amount: Number(data.min_fee_amount ?? 0),
    max_fee_amount: data.max_fee_amount == null ? null : Number(data.max_fee_amount),
  };
}

export function computeFee(fee: ResolvedFee, amount: number): number {
  let out = 0;
  if (fee.fee_model === "fixed") out = fee.fixed_amount;
  else if (fee.fee_model === "percentage") out = amount * fee.percentage_rate;
  else if (fee.fee_model === "hybrid") out = fee.fixed_amount + amount * fee.percentage_rate;
  if (fee.min_fee_amount && out < fee.min_fee_amount) out = fee.min_fee_amount;
  if (fee.max_fee_amount != null && out > fee.max_fee_amount) out = fee.max_fee_amount;
  return Math.max(0, Math.round(out * 100) / 100);
}

// Debit user's primary XAF wallet by appending a fresh account_balances snapshot.
// Returns { ok, balance_after, account_id } or { ok:false, reason }.
export async function debitPrimaryWallet(
  sb: any,
  userId: string,
  amount: number,
  currency: string = "XAF",
): Promise<{ ok: boolean; balance_after?: number; account_id?: string; reason?: string }> {
  if (amount <= 0) return { ok: true, balance_after: 0 };
  const { data: acct } = await sb
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("currency", currency)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!acct) return { ok: false, reason: "no_wallet" };

  const { data: bal } = await sb
    .from("account_balances")
    .select("amount,credit_debit_indicator,balance_datetime")
    .eq("account_id", acct.id)
    .eq("balance_type", "ClosingAvailable")
    .order("balance_datetime", { ascending: false })
    .limit(1)
    .maybeSingle();

  const current = bal
    ? (bal.credit_debit_indicator === "Debit" ? -Number(bal.amount) : Number(bal.amount))
    : 0;
  if (current < amount) return { ok: false, reason: "insufficient_wallet_funds" };
  const next = current - amount;

  await sb.from("account_balances").insert({
    account_id: acct.id,
    balance_type: "ClosingAvailable",
    credit_debit_indicator: next >= 0 ? "Credit" : "Debit",
    amount: Math.abs(next),
    currency,
    balance_datetime: new Date().toISOString(),
  });
  return { ok: true, balance_after: next, account_id: acct.id };
}

export async function recordCardFeeLedger(
  sb: any,
  args: {
    userId: string;
    cardId: string | null;
    feeType: CardFeeType;
    amount: number;
    currency: string;
    accountId?: string | null;
    idempotencyKey: string;
    note?: string;
  },
) {
  await sb.from("transaction_fees").insert({
    transaction_type: args.feeType,
    fee_amount: args.amount,
    currency: args.currency,
    user_id: args.userId,
    metadata: {
      card_id: args.cardId,
      account_id: args.accountId ?? null,
      idempotency_key: args.idempotencyKey,
      note: args.note ?? null,
      source: "cards-v3",
    },
  }).select().maybeSingle();
}
