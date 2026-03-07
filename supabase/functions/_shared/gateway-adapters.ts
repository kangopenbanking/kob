// Gateway Provider Adapters — Unified interface for Flutterwave & Stripe

// Deno runtime type declaration for edge functions (not available in Vite builds)
declare const Deno: { env: { get(key: string): string | undefined } } | undefined;

export interface ChargeRequest {
  amount: number;
  currency: string;
  channel: string;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  tx_ref: string;
  metadata?: Record<string, unknown>;
}

export interface ChargeResult {
  provider_ref: string;
  status: string;
  provider_raw: Record<string, unknown>;
  redirect_url?: string;
}

export interface PayoutRequest {
  amount: number;
  currency: string;
  channel: string;
  beneficiary_account?: string;
  beneficiary_bank?: string;
  beneficiary_phone?: string;
  beneficiary_name?: string;
  narration?: string;
  tx_ref: string;
}

export interface PayoutResult {
  provider_ref: string;
  status: string;
  provider_raw: Record<string, unknown>;
}

export interface RefundRequest {
  provider_ref: string;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  provider_ref: string;
  status: string;
  provider_raw: Record<string, unknown>;
}

// ─── Status Mapping ───

export function mapFlutterwaveStatus(status: string): string {
  const map: Record<string, string> = {
    successful: 'successful',
    completed: 'successful',
    pending: 'processing',
    'pending-validation': 'processing',
    failed: 'failed',
    error: 'failed',
  };
  return map[status?.toLowerCase()] || 'pending';
}

export function mapStripeStatus(status: string): string {
  const map: Record<string, string> = {
    succeeded: 'successful',
    processing: 'processing',
    requires_payment_method: 'pending',
    requires_confirmation: 'pending',
    requires_action: 'pending',
    canceled: 'cancelled',
    requires_capture: 'processing',
  };
  return map[status?.toLowerCase()] || 'pending';
}

export function mapStripeDisputeStatus(status: string): string {
  const map: Record<string, string> = {
    'warning_needs_response': 'open',
    'warning_under_review': 'under_review',
    'warning_closed': 'closed',
    'needs_response': 'open',
    'under_review': 'under_review',
    'charge_refunded': 'won',
    won: 'won',
    lost: 'lost',
  };
  return map[status?.toLowerCase()] || 'open';
}

export function mapPayPalStatus(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'successful',
    PENDING: 'processing',
    UNCLAIMED: 'processing',
    RETURNED: 'failed',
    ONHOLD: 'processing',
    BLOCKED: 'failed',
    REFUNDED: 'refunded',
    REVERSED: 'failed',
    FAILED: 'failed',
    SUCCESS: 'successful',
  };
  return map[status?.toUpperCase()] || 'pending';
}

// ─── Flutterwave Adapter ───

export async function createFlutterwaveCharge(req: ChargeRequest): Promise<ChargeResult> {
  const FLW_SECRET = typeof Deno !== "undefined" ? Deno.env.get('FLUTTERWAVE_SECRET_KEY') : undefined;
  if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  // Detect country from phone number prefix for francophone mobile money
  const phoneStr = req.customer_phone || '';
  let country = 'CM'; // Default Cameroon
  if (phoneStr.startsWith('225')) { country = 'CI'; }
  else if (phoneStr.startsWith('221')) { country = 'SN'; }
  else if (phoneStr.startsWith('226')) { country = 'BF'; }

  // Build payload per Flutterwave v3 docs — top-level fields, NOT nested in customer
  const body: Record<string, unknown> = {
    tx_ref: req.tx_ref,
    amount: req.amount,
    currency: req.currency,
    email: req.customer_email || 'customer@kob.cm',
    phone_number: req.customer_phone,
    fullname: req.customer_name || 'Customer',
  };

  let chargeType = 'charge';

  if (req.channel === 'mobile_money') {
    body.type = 'mobile_money_franco';
    body.country = country;
    chargeType = 'charges?type=mobile_money_franco';
  } else if (req.channel === 'ussd') {
    body.type = 'ussd';
    body.account_bank = '058'; // default GTBank USSD
    chargeType = 'charges?type=ussd';
  } else if (req.channel === 'bank_transfer') {
    body.type = 'bank_transfer';
    chargeType = 'charges?type=bank_transfer';
  } else if (req.channel === 'card') {
    // For card payments on Flutterwave, redirect to hosted checkout
    body.redirect_url = (req.metadata?.redirect_url as string) || 'https://kangopenbanking.com/gateway/callback';
    body.payment_options = 'card';
    chargeType = 'payments'; // Use standard payment link flow
  }

  if (req.metadata) body.meta = req.metadata;

  console.log(`[Flutterwave] Creating charge: ${chargeType}`, { amount: req.amount, currency: req.currency, channel: req.channel, country });

  const endpoint = chargeType === 'payments'
    ? 'https://api.flutterwave.com/v3/payments'
    : `https://api.flutterwave.com/v3/${chargeType}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log('[Flutterwave] Response:', JSON.stringify(data).substring(0, 500));

  if (data.status === 'error') {
    throw new Error(`Flutterwave error: ${data.message || JSON.stringify(data)}`);
  }

  return {
    provider_ref: data.data?.id?.toString() || data.data?.flw_ref || '',
    status: chargeType === 'payments'
      ? 'pending'
      : mapFlutterwaveStatus(data.data?.status || data.status || 'pending'),
    provider_raw: data,
    redirect_url: data.data?.link || data.data?.meta?.authorization?.redirect || undefined,
  };
}

// ─── Stripe Adapter ───

export const ZERO_DECIMAL_CURRENCIES = ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];

export function toStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export async function createStripeCharge(req: ChargeRequest): Promise<ChargeResult> {
  const STRIPE_SECRET = typeof Deno !== "undefined" ? Deno.env.get('STRIPE_SECRET_KEY') : undefined;
  if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

  const stripeAmount = toStripeAmount(req.amount, req.currency);

  const params = new URLSearchParams();
  params.append('amount', stripeAmount.toString());
  params.append('currency', req.currency.toLowerCase());
  params.append('payment_method_types[]', 'card');
  if (req.customer_email) params.append('receipt_email', req.customer_email);
  params.append('metadata[tx_ref]', req.tx_ref);
  params.append('metadata[channel]', req.channel);
  if (req.metadata) {
    Object.entries(req.metadata).forEach(([k, v]) => {
      if (typeof v === 'string') params.append(`metadata[${k}]`, v);
    });
  }

  console.log('[Stripe] Creating PaymentIntent:', { amount: stripeAmount, currency: req.currency });

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Stripe error: ${data.error.message}`);

  console.log('[Stripe] PaymentIntent created:', { id: data.id, status: data.status });

  return {
    provider_ref: data.id || '',
    status: mapStripeStatus(data.status || 'pending'),
    provider_raw: data,
    redirect_url: data.next_action?.redirect_to_url?.url || undefined,
  };
}

// ─── Flutterwave Payout ───

export async function createFlutterwavePayout(req: PayoutRequest): Promise<PayoutResult> {
  const FLW_SECRET = typeof Deno !== "undefined" ? Deno.env.get('FLUTTERWAVE_SECRET_KEY') : undefined;
  if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const body: Record<string, unknown> = {
    account_bank: req.beneficiary_bank || '',
    account_number: req.beneficiary_account || '',
    amount: req.amount,
    currency: req.currency,
    narration: req.narration || `Payout ${req.tx_ref}`,
    reference: req.tx_ref,
    beneficiary_name: req.beneficiary_name || 'Beneficiary',
  };

  console.log('[Flutterwave] Creating payout:', { amount: req.amount, currency: req.currency });

  const res = await fetch('https://api.flutterwave.com/v3/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.status === 'error') throw new Error(`Flutterwave payout failed: ${data.message}`);

  return {
    provider_ref: data.data?.id?.toString() || '',
    status: mapFlutterwaveStatus(data.data?.status || 'pending'),
    provider_raw: data,
  };
}

// ─── Stripe Refund ───

export async function createStripeRefund(req: RefundRequest): Promise<RefundResult> {
  const STRIPE_SECRET = typeof Deno !== "undefined" ? Deno.env.get('STRIPE_SECRET_KEY') : undefined;
  if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

  const params = new URLSearchParams();
  params.append('payment_intent', req.provider_ref);
  params.append('amount', Math.round(req.amount * 100).toString());
  if (req.reason) params.append('reason', 'requested_by_customer');

  const res = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Stripe refund failed: ${data.error.message}`);

  return {
    provider_ref: data.id || '',
    status: data.status === 'succeeded' ? 'successful' : 'processing',
    provider_raw: data,
  };
}

// ─── PayPal Adapter ───

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = typeof Deno !== "undefined" ? Deno.env.get('PAYPAL_CLIENT_ID') : undefined;
  const secret = typeof Deno !== "undefined" ? Deno.env.get('PAYPAL_SECRET') : undefined;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal token');
  return data.access_token;
}

export async function createPayPalPayout(req: PayoutRequest): Promise<PayoutResult> {
  const token = await getPayPalAccessToken();

  const body = {
    sender_batch_header: {
      sender_batch_id: req.tx_ref,
      email_subject: 'Payment from KOB',
      email_message: req.narration || 'You have received a payment',
    },
    items: [{
      recipient_type: 'EMAIL',
      amount: { value: req.amount.toFixed(2), currency: req.currency },
      receiver: req.beneficiary_account,
      note: req.narration || 'Payout',
      sender_item_id: req.tx_ref,
    }],
  };

  const res = await fetch('https://api-m.paypal.com/v1/payments/payouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) throw new Error(`PayPal payout failed: ${data.message || JSON.stringify(data)}`);

  return {
    provider_ref: data.batch_header?.payout_batch_id || '',
    status: mapPayPalStatus(data.batch_header?.batch_status || 'PENDING'),
    provider_raw: data,
  };
}

export async function getPayPalPayoutStatus(batchId: string): Promise<PayoutResult> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`https://api-m.paypal.com/v1/payments/payouts/${batchId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await res.json();
  return {
    provider_ref: batchId,
    status: mapPayPalStatus(data.batch_header?.batch_status || 'PENDING'),
    provider_raw: data,
  };
}

export async function verifyPayPalWebhookSignature(headers: Record<string, string>, body: string, webhookId: string): Promise<boolean> {
  const token = await getPayPalAccessToken();

  const verifyBody = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: JSON.parse(body),
  };

  const res = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyBody),
  });

  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}

// ─── Stripe Payout (via Stripe Transfer to connected account or Refund) ───

export async function createStripeCardPayout(paymentIntentId: string, amount: number, currency: string): Promise<RefundResult> {
  const STRIPE_SECRET = typeof Deno !== "undefined" ? Deno.env.get('STRIPE_SECRET_KEY') : undefined;
  if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

  const stripeAmount = toStripeAmount(amount, currency);
  const params = new URLSearchParams();
  params.append('payment_intent', paymentIntentId);
  params.append('amount', stripeAmount.toString());
  params.append('reason', 'requested_by_customer');

  console.log('[Stripe] Creating automated payout/refund:', { paymentIntentId, amount: stripeAmount, currency });

  const res = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Stripe payout failed: ${data.error.message}`);

  console.log('[Stripe] Automated payout result:', { id: data.id, status: data.status });

  return {
    provider_ref: data.id || '',
    status: data.status === 'succeeded' ? 'successful' : 'processing',
    provider_raw: data,
  };
}

// ─── Stripe Payout Status Check ───

export async function getStripePayoutStatus(refundId: string): Promise<RefundResult> {
  const STRIPE_SECRET = typeof Deno !== "undefined" ? Deno.env.get('STRIPE_SECRET_KEY') : undefined;
  if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

  const res = await fetch(`https://api.stripe.com/v1/refunds/${refundId}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  const data = await res.json();

  return {
    provider_ref: data.id || refundId,
    status: data.status === 'succeeded' ? 'successful' : data.status === 'failed' ? 'failed' : 'processing',
    provider_raw: data,
  };
}

// ─── Flutterwave Transfer Status Check ───

export async function getFlutterwaveTransferStatus(transferId: string): Promise<PayoutResult> {
  const FLW_SECRET = typeof Deno !== "undefined" ? Deno.env.get('FLUTTERWAVE_SECRET_KEY') : undefined;
  if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const res = await fetch(`https://api.flutterwave.com/v3/transfers/${transferId}`, {
    headers: { Authorization: `Bearer ${FLW_SECRET}` },
  });
  const data = await res.json();

  return {
    provider_ref: data.data?.id?.toString() || transferId,
    status: mapFlutterwaveStatus(data.data?.status || 'pending'),
    provider_raw: data,
  };
}

// ─── Flutterwave MoMo Payout ───

export async function createFlutterwaveMomoPayout(req: PayoutRequest): Promise<PayoutResult> {
  const FLW_SECRET = typeof Deno !== "undefined" ? Deno.env.get('FLUTTERWAVE_SECRET_KEY') : undefined;
  if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const body = {
    account_bank: 'MPS',
    account_number: req.beneficiary_phone,
    amount: req.amount,
    currency: req.currency,
    narration: req.narration || `MoMo payout ${req.tx_ref}`,
    reference: req.tx_ref,
    beneficiary_name: req.beneficiary_name,
  };

  const res = await fetch('https://api.flutterwave.com/v3/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.status === 'error') throw new Error(`Flutterwave MoMo payout failed: ${data.message}`);

  return {
    provider_ref: data.data?.id?.toString() || '',
    status: mapFlutterwaveStatus(data.data?.status || 'pending'),
    provider_raw: data,
  };
}

// ─── Fee Calculation ───

// Default fallback rates (used when DB lookup is unavailable)
const DEFAULT_CHANNEL_RATES: Record<string, { rate: number; fixed: number }> = {
  mobile_money: { rate: 0.03, fixed: 50 },
  card: { rate: 0.035, fixed: 100 },
  bank_transfer: { rate: 0.02, fixed: 75 },
  apple_pay: { rate: 0.035, fixed: 100 },
  google_pay: { rate: 0.035, fixed: 100 },
  ussd: { rate: 0.025, fixed: 25 },
  account_funding: { rate: 0.025, fixed: 0 },
  paypal: { rate: 0.035, fixed: 150 },
  virtual_card_topup: { rate: 0.015, fixed: 0 },
  gateway_charge: { rate: 0.03, fixed: 50 },
  gateway_payout: { rate: 0.02, fixed: 75 },
  withdrawal: { rate: 0.015, fixed: 0 },
};

const CHANNEL_TO_TX_TYPE: Record<string, string> = {
  mobile_money: "mobile_money_charge",
  card: "card_payment",
  bank_transfer: "bank_transfer",
  apple_pay: "card_payment",
  google_pay: "card_payment",
  ussd: "ussd_payment",
  account_funding: "account_funding",
  paypal: "paypal_payment",
  virtual_card_topup: "virtual_card_topup",
  gateway_charge: "gateway_charge",
  gateway_payout: "gateway_payout",
  withdrawal: "withdrawal",
};

// Map channels to fee_limits_charges categories
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

/**
 * Calculate gateway fee. Resolution order:
 * 1. fee_structures (merchant → institution → platform)
 * 2. fee_limits_charges (admin-configured per category)
 * 3. Hardcoded fallback
 */
export async function calculateGatewayFee(
  amount: number,
  channel: string,
  supabaseClient?: any,
  opts?: { merchantId?: string; institutionId?: string }
): Promise<{ fee: number; net: number; limits?: { min_amount: number; max_amount: number; daily_limit: number; monthly_limit: number } }> {
  const txType = CHANNEL_TO_TX_TYPE[channel] || channel;
  const today = new Date().toISOString().split("T")[0];

  if (supabaseClient) {
    // Step 1: Try fee_structures (most specific)
    const scopes: { scope: string; filter?: Record<string, string> }[] = [];
    if (opts?.merchantId) scopes.push({ scope: "merchant", filter: { merchant_id: opts.merchantId } });
    if (opts?.institutionId) scopes.push({ scope: "institution", filter: { institution_id: opts.institutionId } });
    scopes.push({ scope: "platform" });

    for (const s of scopes) {
      let query = supabaseClient
        .from("fee_structures")
        .select("percentage_rate, fixed_amount, min_fee_amount, max_fee_amount, fee_model")
        .eq("transaction_type", txType)
        .eq("fee_scope", s.scope)
        .eq("is_active", true)
        .lte("effective_from", today)
        .order("effective_from", { ascending: false })
        .limit(1);

      if (s.filter) {
        for (const [k, v] of Object.entries(s.filter)) {
          query = query.eq(k, v);
        }
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const row = data[0];
        if (row.effective_until && row.effective_until < today) continue;

        const rate = Number(row.percentage_rate) / 100;
        const fixed = Number(row.fixed_amount);
        let fee = Math.round(amount * rate + fixed);

        const minFee = Number(row.min_fee_amount) || 0;
        const maxFee = Number(row.max_fee_amount) || 0;
        if (minFee > 0 && fee < minFee) fee = minFee;
        if (maxFee > 0 && fee > maxFee) fee = maxFee;

        // Also fetch limits from fee_limits_charges
        const limits = await fetchLimitsCharges(supabaseClient, channel);
        return { fee, net: amount - fee, limits };
      }
    }

    // Step 2: Try fee_limits_charges table
    const limitsCategory = CHANNEL_TO_LIMITS_CATEGORY[channel] || channel;
    const { data: limitsRow } = await supabaseClient
      .from("fee_limits_charges")
      .select("*")
      .eq("category", limitsCategory)
      .eq("is_active", true)
      .maybeSingle();

    if (limitsRow) {
      const rate = Number(limitsRow.percentage_charge) / 100;
      const fixed = Number(limitsRow.fixed_charge);
      let fee = Math.round(amount * rate + fixed);

      const maxCap = Number(limitsRow.max_charge_cap);
      if (maxCap > 0 && fee > maxCap) fee = maxCap;

      return {
        fee,
        net: amount - fee,
        limits: {
          min_amount: Number(limitsRow.min_amount) || 0,
          max_amount: Number(limitsRow.max_amount) || 0,
          daily_limit: Number(limitsRow.daily_limit) || -1,
          monthly_limit: Number(limitsRow.monthly_limit) || -1,
        },
      };
    }
  }

  // Step 3: Hardcoded fallback
  const defaults = DEFAULT_CHANNEL_RATES[channel] || { rate: 0.035, fixed: 0 };
  const fee = Math.round(amount * defaults.rate + defaults.fixed);
  return { fee, net: amount - fee };
}

/** Fetch limits from fee_limits_charges for a given channel */
async function fetchLimitsCharges(supabaseClient: any, channel: string) {
  const category = CHANNEL_TO_LIMITS_CATEGORY[channel] || channel;
  const { data } = await supabaseClient
    .from("fee_limits_charges")
    .select("min_amount, max_amount, daily_limit, monthly_limit")
    .eq("category", category)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return undefined;
  return {
    min_amount: Number(data.min_amount) || 0,
    max_amount: Number(data.max_amount) || 0,
    daily_limit: Number(data.daily_limit) || -1,
    monthly_limit: Number(data.monthly_limit) || -1,
  };
}

/**
 * Synchronous fallback for callers that can't await.
 * Preserved for backward compatibility — prefer the async version.
 */
export function calculateGatewayFeeSync(amount: number, channel: string): { fee: number; net: number } {
  const defaults = DEFAULT_CHANNEL_RATES[channel] || { rate: 0.035, fixed: 0 };
  const fee = Math.round(amount * defaults.rate + defaults.fixed);
  return { fee, net: amount - fee };
}
