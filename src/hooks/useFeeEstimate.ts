import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeeEstimate {
  feePercent: number;
  fixedFee: number;
  totalFee: number;
  netAmount: number;
  source: "db" | "fallback";
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
  intra_bank_transfer: "intra_bank_transfer",
  inter_bank_transfer: "inter_bank_transfer",
  hotel_booking: "hotel_booking",
  flight_booking: "flight_booking",
  tour_booking: "tour_booking",
  travel_booking: "travel_booking",
  travel_cancellation_fee: "travel_cancellation_fee",
  credit_score_inquiry: "credit_score_inquiry",
  credit_report_inquiry: "credit_report_inquiry",
  credit_premium_subscription: "credit_premium_subscription",
  paypal: "paypal_payment",
  ussd: "ussd_payment",
  apple_pay: "card_payment",
  google_pay: "card_payment",
  account_funding: "account_funding",
  virtual_card_topup: "virtual_card_topup",
  card_issuance_fee: "card_issuance_fee",
  card_maintenance_fee: "card_maintenance_fee",
  card_transaction_fee: "card_transaction_fee",
  withdrawal: "withdrawal",
  fx_conversion: "fx_conversion",
  gateway_charge: "gateway_charge",
  gateway_payout: "gateway_payout",
  credit_report_purchase: "credit_report_purchase",
  overdraft_fee: "overdraft_fee",
  loan_processing_fee: "loan_processing_fee",
  atm_withdrawal: "atm_withdrawal",
  standing_order: "standing_order",
  dormancy_fee: "dormancy_fee",
  remittance_inbound: "remittance_inbound",
  remittance_outbound: "remittance_outbound",
  remittance_bank_credit: "remittance_bank_credit",
  remittance_wallet_credit: "remittance_wallet_credit",
  remittance_bill_payment: "remittance_bill_payment",
  remittance_fx_markup: "remittance_fx_markup",
  overdraft_interest: "overdraft_interest",
  overdraft_setup_fee: "overdraft_setup_fee",
  overdraft_renewal_fee: "overdraft_renewal_fee",
  statement_download_consumer: "statement_download_consumer",
  statement_download_banking: "statement_download_banking",
};

// Last-resort fallback rates — only used when fee_structures DB has no matching row.
// These MUST stay in sync with the platform-scope fee_structures entries.
// Prefer adding fee_structures rows in the admin panel instead of relying on these.
const FALLBACK_RATES: Record<string, { rate: number; fixed: number }> = {
  mobile_money_charge: { rate: 0.03, fixed: 50 },
  card_payment: { rate: 0.035, fixed: 100 },
  bank_transfer: { rate: 0.003, fixed: 150 },
  intra_bank_transfer: { rate: 0, fixed: 100 },
  inter_bank_transfer: { rate: 0.005, fixed: 200 },
  hotel_booking: { rate: 0.015, fixed: 50 },
  flight_booking: { rate: 0.02, fixed: 100 },
  tour_booking: { rate: 0.015, fixed: 50 },
  travel_booking: { rate: 0.015, fixed: 50 },
  travel_cancellation_fee: { rate: 0, fixed: 200 },
  credit_score_inquiry: { rate: 0, fixed: 100 },
  credit_report_inquiry: { rate: 0, fixed: 500 },
  credit_premium_subscription: { rate: 0, fixed: 1500 },
  paypal_payment: { rate: 0.035, fixed: 150 },
  ussd_payment: { rate: 0.025, fixed: 25 },
  account_funding: { rate: 0.025, fixed: 0 },
  virtual_card_topup: { rate: 0.015, fixed: 0 },
  card_issuance_fee: { rate: 0, fixed: 2500 },
  card_maintenance_fee: { rate: 0, fixed: 500 },
  card_transaction_fee: { rate: 0.015, fixed: 0 },
  withdrawal: { rate: 0.015, fixed: 0 },
  fx_conversion: { rate: 0.015, fixed: 0 },
  gateway_charge: { rate: 0.03, fixed: 50 },
  gateway_payout: { rate: 0.02, fixed: 75 },
  credit_report_purchase: { rate: 0, fixed: 2500 },
  overdraft_fee: { rate: 0.05, fixed: 200 },
  loan_processing_fee: { rate: 0.02, fixed: 500 },
  atm_withdrawal: { rate: 0, fixed: 150 },
  standing_order: { rate: 0, fixed: 100 },
  dormancy_fee: { rate: 0, fixed: 500 },
  remittance_inbound: { rate: 0.02, fixed: 100 },
  remittance_outbound: { rate: 0.025, fixed: 150 },
  remittance_bank_credit: { rate: 0.015, fixed: 75 },
  remittance_wallet_credit: { rate: 0.01, fixed: 50 },
  remittance_bill_payment: { rate: 0.02, fixed: 100 },
  remittance_fx_markup: { rate: 0.015, fixed: 0 },
  overdraft_interest: { rate: 0.08, fixed: 0 },
  overdraft_setup_fee: { rate: 0, fixed: 1000 },
  overdraft_renewal_fee: { rate: 0, fixed: 500 },
  statement_download_consumer: { rate: 0, fixed: 500 },
  statement_download_banking: { rate: 0, fixed: 500 },
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

  const { data: dbFee, isLoading } = useQuery({
    queryKey: ["fee-estimate", txType, scope, merchantId, institutionId],
    queryFn: async () => {
      // Try fee_structures (merchant → institution → platform)
      const scopes: { scope: string; id?: string }[] = [];
      if (scope === "merchant" && merchantId) {
        scopes.push({ scope: "merchant", id: merchantId });
      }
      if (institutionId) {
        scopes.push({ scope: "institution", id: institutionId });
      }
      scopes.push({ scope: "platform" });

      const today = new Date().toISOString().split("T")[0];
      for (const s of scopes) {
        let query = supabase
          .from("fee_structures")
          .select("percentage_rate, fixed_amount, fee_model, daily_limit, monthly_limit, max_charge_cap")
          .eq("transaction_type", txType)
          .eq("fee_scope", s.scope)
          .eq("is_active", true)
          .lte("effective_from", today)
          .or(`effective_until.is.null,effective_until.gte.${today}`)
          .order("effective_from", { ascending: false })
          .limit(1);

        if (s.scope === "merchant" && s.id) {
          query = query.eq("merchant_id", s.id);
        } else if (s.scope === "institution" && s.id) {
          query = query.eq("institution_id", s.id);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          const row = data[0];
          return {
            rate: Number(row.percentage_rate) / 100,
            fixed: Number(row.fixed_amount),
            source: "db" as const,
            limits: {
              min_amount: 0,
              max_amount: 0,
              daily_limit: Number(row.daily_limit) || -1,
              monthly_limit: Number(row.monthly_limit) || -1,
              max_charge_cap: Number(row.max_charge_cap) || -1,
            },
          };
        }
      }

      return null;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes — fee structures change infrequently but should sync reasonably fast
    refetchOnWindowFocus: true, // Re-validate fees when user returns to tab
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
