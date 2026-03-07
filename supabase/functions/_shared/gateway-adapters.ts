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
    if (!req.customer_phone) throw new Error('customer_phone is required for mobile_money charges');
    chargeType = 'mobile_money_franco';
    body.country = country;
  } else if (req.channel === 'card') {
    chargeType = 'card';
    body.redirect_url = req.metadata?.redirect_url || 'https://kangopenbanking.com/gateway/callback';
  }

  console.log('[Flutterwave] Sending charge request:', JSON.stringify({
    type: chargeType, amount: req.amount, currency: req.currency, country, phone: phoneStr?.slice(0, 6) + '***',
  }));

  let res: Response;
  try {
    res = await fetch(`https://api.flutterwave.com/v3/charges?type=${chargeType}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Flutterwave API request timed out after 60s');
    }
    throw err;
  }

  // Defensive response parsing
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('[Flutterwave] Non-JSON response:', res.status, text.slice(0, 500));
    throw new Error(`Flutterwave returned non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.error('[Flutterwave] JSON parse failed:', parseErr);
    throw new Error('Failed to parse Flutterwave response as JSON');
  }

  console.log('[Flutterwave] Charge response:', JSON.stringify({
    status: data.status,
    message: data.message,
    data_status: data.data?.status,
    flw_ref: data.data?.flw_ref,
    auth_mode: data.meta?.authorization?.mode,
    has_redirect: !!data.meta?.authorization?.redirect_url,
  }));

  // Throw on API-level errors so the intent creator doesn't save a broken intent
  if (data.status === 'error') {
    throw new Error(`Flutterwave charge failed: ${data.message || 'Unknown error'}`);
  }

  const authMode = data.meta?.authorization?.mode;
  const redirectUrl = data.meta?.authorization?.redirect_url;

  return {
    provider_ref: data.data?.flw_ref || data.data?.id?.toString() || '',
    status: mapFlutterwaveStatus(data.data?.status || 'pending'),
    provider_raw: data,
    redirect_url: redirectUrl || undefined,
  };
}

// Zero-decimal currencies (Stripe expects amount in smallest unit; these have no cents)
const ZERO_DECIMAL_CURRENCIES = ['xaf','xof','bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv'];

export { ZERO_DECIMAL_CURRENCIES };

export function toStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
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
  params.append('metadata[channel]', 'card');

  // Pass additional metadata from request
  if (req.metadata) {
    for (const [key, value] of Object.entries(req.metadata)) {
      if (value !== null && value !== undefined && key !== 'tx_ref' && key !== 'channel') {
        params.append(`metadata[${key}]`, String(value));
      }
    }
  }

  console.log('[Stripe] Creating PaymentIntent:', { amount: stripeAmount, currency: req.currency.toLowerCase(), tx_ref: req.tx_ref });

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();

  if (data.error) {
    console.error('[Stripe] PaymentIntent error:', JSON.stringify(data.error));
    throw new Error(`Stripe error: ${data.error.message || data.error.type}`);
  }

  console.log('[Stripe] PaymentIntent created:', { id: data.id, status: data.status, has_client_secret: !!data.client_secret });

  return {
    provider_ref: data.id || '',
    status: mapStripeStatus(data.status || 'pending'),
    provider_raw: data,
  };
}

// ─── Flutterwave Payout ───

export async function createFlutterwavePayout(req: PayoutRequest): Promise<PayoutResult> {
  const FLW_SECRET = typeof Deno !== "undefined" ? Deno.env.get('FLUTTERWAVE_SECRET_KEY') : undefined;
  if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const body: Record<string, unknown> = {
    account_bank: req.beneficiary_bank,
    account_number: req.beneficiary_account || req.beneficiary_phone,
    amount: req.amount,
    currency: req.currency,
    narration: req.narration || `Payout ${req.tx_ref}`,
    reference: req.tx_ref,
    beneficiary_name: req.beneficiary_name,
  };

  if (req.channel === 'mobile_money') {
    body.account_bank = 'MPS'; // MoMo
    body.account_number = req.beneficiary_phone;
  }

  const res = await fetch('https://api.flutterwave.com/v3/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

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
  params.append('amount', toStripeAmount(req.amount, req.reason?.includes('currency:') ? req.reason.split('currency:')[1].trim() : 'xaf').toString());
  if (req.reason) params.append('reason', req.reason);

  const res = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();

  return {
    provider_ref: data.id || '',
    status: data.status === 'succeeded' ? 'successful' : 'processing',
    provider_raw: data,
  };
}

// ─── HMAC Signing for Merchant Webhooks ───

export async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── PayPal Status Mapping ───

export function mapPayPalStatus(status: string): string {
  const map: Record<string, string> = {
    'SUCCESS': 'successful',
    'FAILED': 'failed',
    'PENDING': 'processing',
    'UNCLAIMED': 'pending',
    'RETURNED': 'failed',
    'ONHOLD': 'processing',
    'BLOCKED': 'failed',
    'REFUNDED': 'failed',
    'REVERSED': 'failed',
  };
  return map[status?.toUpperCase()] || 'pending';
}

// ─── PayPal OAuth2 Token Management ───

let _paypalTokenCache: { token: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (_paypalTokenCache && Date.now() < _paypalTokenCache.expiresAt - 300_000) {
    return _paypalTokenCache.token;
  }

  const PAYPAL_CLIENT_ID = typeof Deno !== "undefined" ? Deno.env.get('PAYPAL_CLIENT_ID') : undefined;
  const PAYPAL_CLIENT_SECRET = typeof Deno !== "undefined" ? Deno.env.get('PAYPAL_CLIENT_SECRET') : undefined;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal credentials not configured');

  const baseUrl = 'https://api-m.paypal.com'; // Production; use api-m.sandbox.paypal.com for sandbox

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`PayPal OAuth2 failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();
  _paypalTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

// ─── PayPal Payout ───

export interface PayPalPayoutRequest {
  sender_batch_id: string;
  items: {
    recipient_type: 'EMAIL' | 'PHONE' | 'PAYPAL_ID';
    receiver: string;
    amount: number;
    currency: string;
    note?: string;
    sender_item_id: string;
  }[];
}

export interface PayPalPayoutResult {
  batch_id: string;
  batch_status: string;
  items: { payout_item_id: string; transaction_status: string }[];
  provider_raw: Record<string, unknown>;
}

export async function createPayPalPayout(req: PayPalPayoutRequest): Promise<PayPalPayoutResult> {
  const token = await getPayPalAccessToken();

  const body = {
    sender_batch_header: {
      sender_batch_id: req.sender_batch_id,
      email_subject: 'You have a payout!',
      email_message: 'You have received a payout from Kang Open Banking.',
    },
    items: req.items.map(item => ({
      recipient_type: item.recipient_type,
      amount: { value: (item.amount / 100).toFixed(2), currency: item.currency },
      receiver: item.receiver,
      note: item.note || `Payout ${item.sender_item_id}`,
      sender_item_id: item.sender_item_id,
    })),
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

  if (!res.ok) {
    throw new Error(`PayPal Payout failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return {
    batch_id: data.batch_header?.payout_batch_id || '',
    batch_status: data.batch_header?.batch_status || 'PENDING',
    items: (data.items || []).map((i: any) => ({
      payout_item_id: i.payout_item_id || '',
      transaction_status: i.transaction_status || 'PENDING',
    })),
    provider_raw: data,
  };
}

export async function getPayPalPayoutStatus(batchId: string): Promise<PayPalPayoutResult> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`https://api-m.paypal.com/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  const data = await res.json();

  return {
    batch_id: data.batch_header?.payout_batch_id || batchId,
    batch_status: data.batch_header?.batch_status || 'PENDING',
    items: (data.items || []).map((i: any) => ({
      payout_item_id: i.payout_item_id || '',
      transaction_status: i.transaction_status || 'PENDING',
    })),
    provider_raw: data,
  };
}

// ─── PayPal Webhook Signature Verification ───

export async function verifyPayPalWebhookSignature(
  headers: Record<string, string>,
  body: string,
  webhookId: string,
): Promise<boolean> {
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
};

/**
 * Calculate gateway fee. If a supabaseClient is provided, attempts DB lookup
 * with resolution: merchant → institution → platform → hardcoded fallback.
 */
export async function calculateGatewayFee(
  amount: number,
  channel: string,
  supabaseClient?: any,
  opts?: { merchantId?: string; institutionId?: string }
): Promise<{ fee: number; net: number }> {
  const txType = CHANNEL_TO_TX_TYPE[channel] || channel;

  // Try dynamic DB lookup if client provided
  if (supabaseClient) {
    const scopes: { scope: string; filter?: Record<string, string> }[] = [];
    if (opts?.merchantId) scopes.push({ scope: "merchant", filter: { merchant_id: opts.merchantId } });
    if (opts?.institutionId) scopes.push({ scope: "institution", filter: { institution_id: opts.institutionId } });
    scopes.push({ scope: "platform" });

    for (const s of scopes) {
      let query = supabaseClient
        .from("fee_structures")
        .select("percentage_rate, fixed_amount")
        .eq("transaction_type", txType)
        .eq("fee_scope", s.scope)
        .eq("is_active", true)
        .lte("effective_from", new Date().toISOString().split("T")[0])
        .order("effective_from", { ascending: false })
        .limit(1);

      if (s.filter) {
        for (const [k, v] of Object.entries(s.filter)) {
          query = query.eq(k, v);
        }
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const rate = Number(data[0].percentage_rate) / 100;
        const fixed = Number(data[0].fixed_amount);
        const fee = Math.round(amount * rate + fixed);
        return { fee, net: amount - fee };
      }
    }
  }

  // Fallback to hardcoded rates
  const defaults = DEFAULT_CHANNEL_RATES[channel] || { rate: 0.035, fixed: 0 };
  const fee = Math.round(amount * defaults.rate + defaults.fixed);
  return { fee, net: amount - fee };
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
