// PTP missed-payment fee calculation helper.
// Pure logic — no IO, used by ptp-settle (sweep + match→broken paths).
// Fee config lives on loan_products: ptp_missed_fee_enabled / _type / _value / _cap / _grace_days.

export type PtpFeeType = 'fixed' | 'percentage';

export interface PtpFeeConfig {
  ptp_missed_fee_enabled?: boolean | null;
  ptp_missed_fee_type?: PtpFeeType | string | null;
  ptp_missed_fee_value?: number | string | null;
  ptp_missed_fee_cap?: number | string | null;
  ptp_missed_fee_grace_days?: number | string | null;
}

export interface PtpFeeResult {
  enabled: boolean;
  amount: number;            // final amount to charge (after cap), 2dp rounded
  type: PtpFeeType;
  raw_amount: number;        // amount before cap
  capped: boolean;
}

/**
 * Compute the missed-payment fee for a promise.
 * Returns {enabled:false, amount:0} when the product has no fee configured
 * or when the missed amount is non-positive.
 */
export function computeMissedFee(
  product: PtpFeeConfig | null | undefined,
  missedAmount: number,
): PtpFeeResult {
  const disabled: PtpFeeResult = { enabled: false, amount: 0, type: 'fixed', raw_amount: 0, capped: false };
  if (!product || !product.ptp_missed_fee_enabled) return disabled;
  if (!Number.isFinite(missedAmount) || missedAmount <= 0) return disabled;

  const type = (product.ptp_missed_fee_type === 'percentage' ? 'percentage' : 'fixed') as PtpFeeType;
  const value = Number(product.ptp_missed_fee_value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return disabled;

  let raw = type === 'percentage' ? (missedAmount * value) / 100 : value;
  raw = Math.max(0, raw);

  const cap = product.ptp_missed_fee_cap == null ? null : Number(product.ptp_missed_fee_cap);
  let capped = false;
  let amount = raw;
  if (cap != null && Number.isFinite(cap) && cap > 0 && amount > cap) {
    amount = cap;
    capped = true;
  }

  // 2-decimal rounding (banking currencies; XAF/XOF callers should pass whole amounts).
  amount = Math.round(amount * 100) / 100;
  return { enabled: true, amount, type, raw_amount: Math.round(raw * 100) / 100, capped };
}
