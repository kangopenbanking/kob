// ============================================================
// @kangopenbanking/sdk — Type Definitions
// Kang Open Banking v1 API
// ============================================================

// --- Auth ---
export interface OAuthTokenRequest {
  grant_type: 'client_credentials' | 'authorization_code' | 'refresh_token';
  client_id: string;
  client_secret?: string;
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

// --- AISP ---
export interface Account {
  id: string;
  account_id: string;
  account_holder_name: string;
  account_type: string;
  account_subtype: string;
  currency: string;
  identification_scheme: string;
  identification_value: string;
  nickname?: string;
  is_active: boolean;
  institution_id?: string;
  data_freshness?: 'realtime' | 'daily_import' | 'manual';
  opened_date?: string;
}

export interface Balance {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  balance_type: string;
  credit_debit_indicator: string;
  balance_datetime: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  credit_debit_indicator: string;
  status: string;
  booking_date?: string;
  value_date?: string;
  transaction_reference?: string;
  merchant_name?: string;
  description?: string;
  category?: string;
}

export interface Beneficiary {
  id: string;
  account_id: string;
  beneficiary_name: string;
  beneficiary_account: string;
  bank_code?: string;
  currency: string;
}

// --- PISP ---
export interface PaymentConsent {
  consent_id: string;
  status: string;
  debtor_account: string;
  creditor_account: string;
  amount: number;
  currency: string;
}

export interface PaymentInitiation {
  id: string;
  consent_id: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
}

// --- Gateway ---
export type ChargeChannel = 'mobile_money' | 'card' | 'bank_transfer' | 'ussd' | 'paypal' | 'apple_pay' | 'google_pay';
export type ChargeStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled' | 'refunded';

export interface CreateChargeRequest {
  merchant_id: string;
  amount: number;
  currency?: string;
  channel: ChargeChannel;
  customer_email?: string;
  customer_phone?: string;
  tx_ref: string;
  redirect_url?: string;
  metadata?: Record<string, unknown>;
}

export interface Charge {
  id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  channel: ChargeChannel;
  status: ChargeStatus;
  tx_ref: string;
  provider?: string;
  provider_reference?: string;
  created_at: string;
  verified_at?: string;
}

export interface CreateRefundRequest {
  charge_id: string;
  amount?: number;
  reason?: string;
}

export interface Refund {
  id: string;
  charge_id: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  created_at: string;
}

export interface CreatePayoutRequest {
  merchant_id: string;
  amount: number;
  currency?: string;
  channel: 'bank_transfer' | 'mobile_money' | 'paypal';
  beneficiary_name: string;
  beneficiary_account: string;
  beneficiary_bank_code?: string;
  narration?: string;
}

export interface Payout {
  id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  channel: string;
  status: string;
  created_at: string;
}

export interface FeeEstimate {
  amount: number;
  fee_amount: number;
  net_amount: number;
  fee_percentage: string;
  fixed_fee: number;
}

// --- Sandbox ---
export interface SandboxAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  currency: string;
}

// --- Webhooks ---
export interface WebhookEvent {
  id: string;
  event: string;
  data: Record<string, unknown>;
  created_at: string;
}

// --- Pay by Bank ---
export type PayByBankStatus = 'awaiting_auth' | 'authorized' | 'submitted' | 'processing' | 'completed' | 'failed' | 'expired' | 'rejected';

export interface CreatePayByBankIntentRequest {
  merchant_id: string;
  amount: number;
  currency?: string;
  redirect_uri: string;
  state: string;
  description?: string;
  creditor_account?: string;
  creditor_name?: string;
  customer_email?: string;
}

export interface PayByBankIntent {
  id: string;
  merchant_id: string;
  consent_id: string;
  amount: number;
  currency: string;
  redirect_uri: string;
  state: string;
  status: PayByBankStatus;
  merchant_name?: string;
  merchant_logo_url?: string;
  debtor_account?: string;
  creditor_account?: string;
  creditor_name?: string;
  description?: string;
  expires_at: string;
  authorization_url?: string;
  customer_email?: string;
  customer_user_id?: string;
  metadata?: Record<string, unknown>;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PayByBankIntentResponse {
  intent_id: string;
  consent_id: string;
  authorization_url: string;
  expires_at: string;
  status: PayByBankStatus;
}

// --- Common ---
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiError {
  error: string;
  error_code: string;
  message: string;
  error_id: string;
  timestamp: string;
}

export interface KOBClientConfig {
  clientId: string;
  clientSecret?: string;
  baseUrl?: string;
  environment?: 'sandbox' | 'production';
  timeout?: number;
  apiKey?: string;
}

// --- Idempotency (Phase 5a) ---
export type IdempotencyErrorCode =
  | 'IDEMPOTENCY_KEY_INVALID'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_KEY_IN_FLIGHT';

export interface IdempotencyError {
  error: {
    type: 'idempotency_error' | 'invalid_request_error';
    code: IdempotencyErrorCode;
    message: string;
  };
}

// --- Webhook Reliability (Phase 2) ---
export interface WebhookReplayRequest {
  reason?: string;
}
export interface WebhookReplayResult {
  delivery_id: string;
  replayed_from: string;
  status: 'queued' | 'delivered' | 'failed';
  created_at: string;
}
export type WebhookEndpointHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'idle';
export interface WebhookEndpointHealth {
  endpoint_id: string;
  window: '24h';
  total_deliveries: number;
  success_rate: number;
  latency_ms: { p50: number; p95: number; p99: number };
  status: WebhookEndpointHealthStatus;
  computed_at: string;
}

// --- Reports / CSV exports (Phase 3) ---
export type ReportFormat = 'json' | 'csv';
export interface ReportQuery {
  merchant_id?: string;
  from?: string;
  to?: string;
  format?: ReportFormat;
  limit?: number;
  offset?: number;
}
