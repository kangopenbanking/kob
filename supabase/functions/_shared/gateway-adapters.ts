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
