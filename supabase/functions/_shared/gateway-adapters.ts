// Gateway Provider Adapters — Unified interface for Flutterwave & Stripe

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
  const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const body: Record<string, unknown> = {
    tx_ref: req.tx_ref,
    amount: req.amount,
    currency: req.currency,
    redirect_url: req.metadata?.redirect_url || 'https://kangopenbanking.com/gateway/callback',
    customer: {
      email: req.customer_email || 'customer@example.com',
      phonenumber: req.customer_phone,
      name: req.customer_name,
    },
    meta: req.metadata,
  };

  if (req.channel === 'mobile_money') {
    body.type = 'mobile_money_franco';
    body.phone_number = req.customer_phone;
  }

  const res = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_franco', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  return {
    provider_ref: data.data?.flw_ref || data.data?.id?.toString() || '',
    status: mapFlutterwaveStatus(data.data?.status || data.status || 'pending'),
    provider_raw: data,
    redirect_url: data.meta?.authorization?.redirect,
  };
}

export async function createStripeCharge(req: ChargeRequest): Promise<ChargeResult> {
  const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
  if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

  const params = new URLSearchParams();
  params.append('amount', Math.round(req.amount).toString());
  params.append('currency', req.currency.toLowerCase());
  params.append('payment_method_types[]', 'card');
  if (req.customer_email) params.append('receipt_email', req.customer_email);
  params.append('metadata[tx_ref]', req.tx_ref);
  params.append('metadata[channel]', 'card');

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
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
    status: mapStripeStatus(data.status || 'pending'),
    provider_raw: data,
  };
}

// ─── Flutterwave Payout ───

export async function createFlutterwavePayout(req: PayoutRequest): Promise<PayoutResult> {
  const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
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
  const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
  if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

  const params = new URLSearchParams();
  params.append('payment_intent', req.provider_ref);
  params.append('amount', Math.round(req.amount).toString());
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

// ─── Fee Calculation ───

export function calculateGatewayFee(amount: number, channel: string): { fee: number; net: number } {
  let feeRate = 0.035; // 3.5% default
  let fixedFee = 0;

  if (channel === 'mobile_money') {
    feeRate = 0.03;
    fixedFee = 50; // 50 XAF fixed
  } else if (channel === 'card') {
    feeRate = 0.035;
    fixedFee = 100;
  } else if (channel === 'bank_transfer') {
    feeRate = 0.02;
    fixedFee = 75;
  } else if (channel === 'apple_pay' || channel === 'google_pay') {
    feeRate = 0.035;
    fixedFee = 100;
  } else if (channel === 'ussd') {
    feeRate = 0.025;
    fixedFee = 25;
  } else if (channel === 'account_funding') {
    feeRate = 0.025;
    fixedFee = 0;
  }

  const fee = Math.round(amount * feeRate + fixedFee);
  return { fee, net: amount - fee };
}
