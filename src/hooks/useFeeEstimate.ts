import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeeEstimate {
  feePercent: number;
  fixedFee: number;
  totalFee: number;
  netAmount: number;
  source: "db" | "limits" | "fallback";
  limits?: {
    min_amount: number;
    max_amount: number;
    daily_limit: number;
    monthly_limit: number;
    max_charge_cap: number;
  };
}

// Maps payment method / channel names to fee_structures transaction_type
const CHANNEL_TO_TX_TYPE: Record<string, string> = {
  mobile_money: "mobile_money_charge",
  card: "card_payment",
  bank_transfer: "bank_transfer",
  paypal: "paypal_payment",
  ussd: "ussd_payment",
  apple_pay: "card_payment",
  google_pay: "card_payment",
  account_funding: "account_funding",
  virtual_card_topup: "virtual_card_topup",
  withdrawal: "withdrawal",
  fx_conversion: "fx_conversion",
  gateway_charge: "gateway_charge",
  gateway_payout: "gateway_payout",
};

// Maps channels to fee_limits_charges categories
const CHANNEL_TO_LIMITS_CATEGORY: Record<string, string> = {
  mobile_money: "send_money",
  card: "payment_charges",
  bank_transfer: "bank_transfer",
  apple_pay: "payment_charges",
  google_pay: "payment_charges",
  ussd: "payment_charges",
  account_funding: "cash_in",
  paypal: "payment_charges",
  virtual_card_topup: "cash_in",
  gateway_charge: "payment_charges",
  gateway_payout: "cash_out",
  withdrawal: "cash_out",
};

// Hardcoded fallback rates (backward compatibility)
const FALLBACK_RATES: Record<string, { rate: number; fixed: number }> = {
  mobile_money_charge: { rate: 0.03, fixed: 50 },
  card_payment: { rate: 0.035, fixed: 100 },
  bank_transfer: { rate: 0.02, fixed: 75 },
  paypal_payment: { rate: 0.035, fixed: 150 },
  ussd_payment: { rate: 0.025, fixed: 25 },
  account_funding: { rate: 0.025, fixed: 0 },
  virtual_card_topup: { rate: 0.015, fixed: 0 },
  withdrawal: { rate: 0.015, fixed: 0 },
  fx_conversion: { rate: 0.015, fixed: 0 },
};

interface UseFeeEstimateOptions {
  channel: string;
  amount?: number;
  scope?: "platform" | "institution" | "merchant";
  merchantId?: string;
  institutionId?: string;
  enabled?: boolean;
}

export function useFeeEstimate({
  channel,
  amount = 0,
  scope = "platform",
  merchantId,
  institutionId,
  enabled = true,
}: UseFeeEstimateOptions): {
  fee: FeeEstimate;
  isLoading: boolean;
} {
  const txType = CHANNEL_TO_TX_TYPE[channel] || channel;
  const limitsCategory = CHANNEL_TO_LIMITS_CATEGORY[channel] || channel;

  const { data: dbFee, isLoading } = useQuery({
    queryKey: ["fee-estimate", txType, limitsCategory, scope, merchantId, institutionId],
    queryFn: async () => {
      // Step 1: Try fee_structures (merchant → institution → platform)
      const scopes: { scope: string; id?: string }[] = [];
      if (scope === "merchant" && merchantId) {
        scopes.push({ scope: "merchant", id: merchantId });
      }
      if (institutionId) {
        scopes.push({ scope: "institution", id: institutionId });
      }
      scopes.push({ scope: "platform" });

      for (const s of scopes) {
        let query = supabase
          .from("fee_structures")
          .select("percentage_rate, fixed_amount, fee_model")
          .eq("transaction_type", txType)
          .eq("fee_scope", s.scope)
          .eq("is_active", true)
          .lte("effective_from", new Date().toISOString().split("T")[0])
          .order("effective_from", { ascending: false })
          .limit(1);

        if (s.scope === "merchant" && s.id) {
          query = query.eq("merchant_id", s.id);
        } else if (s.scope === "institution" && s.id) {
          query = query.eq("institution_id", s.id);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          // Also fetch limits from fee_limits_charges
          const limits = await fetchLimitsForCategory(limitsCategory);
          return {
            rate: Number(data[0].percentage_rate) / 100,
            fixed: Number(data[0].fixed_amount),
            source: "db" as const,
            limits,
          };
        }
      }

      // Step 2: Try fee_limits_charges table
      const { data: limitsRow } = await (supabase as any)
        .from("fee_limits_charges")
        .select("*")
        .eq("category", limitsCategory)
        .eq("is_active", true)
        .maybeSingle();

      if (limitsRow) {
        return {
          rate: Number(limitsRow.percentage_charge) / 100,
          fixed: Number(limitsRow.fixed_charge),
          source: "limits" as const,
          limits: {
            min_amount: Number(limitsRow.min_amount) || 0,
            max_amount: Number(limitsRow.max_amount) || 0,
            daily_limit: Number(limitsRow.daily_limit) || -1,
            monthly_limit: Number(limitsRow.monthly_limit) || -1,
            max_charge_cap: Number(limitsRow.max_charge_cap) || -1,
          },
        };
      }

      return null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const rate = dbFee?.rate ?? FALLBACK_RATES[txType]?.rate ?? 0.035;
  const fixed = dbFee?.fixed ?? FALLBACK_RATES[txType]?.fixed ?? 0;
  const source = dbFee?.source ?? "fallback";

  let totalFee = amount > 0 ? Math.round(amount * rate + fixed) : 0;

  // Apply max charge cap from limits
  const maxCap = dbFee?.limits?.max_charge_cap;
  if (maxCap && maxCap > 0 && totalFee > maxCap) {
    totalFee = maxCap;
  }

  const netAmount = amount - totalFee;

  return {
    fee: {
      feePercent: rate,
      fixedFee: fixed,
      totalFee,
      netAmount,
      source,
      limits: dbFee?.limits,
    },
    isLoading,
  };
}

async function fetchLimitsForCategory(category: string) {
  const { data } = await (supabase as any)
    .from("fee_limits_charges")
    .select("min_amount, max_amount, daily_limit, monthly_limit, max_charge_cap")
    .eq("category", category)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return undefined;
  return {
    min_amount: Number(data.min_amount) || 0,
    max_amount: Number(data.max_amount) || 0,
    daily_limit: Number(data.daily_limit) || -1,
    monthly_limit: Number(data.monthly_limit) || -1,
    max_charge_cap: Number(data.max_charge_cap) || -1,
  };
}
