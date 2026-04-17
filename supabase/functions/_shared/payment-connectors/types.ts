// Shared PaymentConnector contract for BYO mobile-money rails.
// Every connector (MTN MoMo, Orange Money, Flutterwave) implements this.

export type ConnectorId = 'mtn_momo' | 'orange_money' | 'flutterwave';
export type ConnectorEnvironment = 'sandbox' | 'live';

export interface ChargePayload {
  amount: number;
  currency: string;
  phone_number: string;
  reference: string;
  description?: string;
  callback_url?: string;
  customer_email?: string;
  customer_name?: string;
  metadata?: Record<string, unknown>;
}

export interface ChargeResult {
  success: boolean;
  provider_reference?: string;
  status: 'pending' | 'successful' | 'failed';
  raw?: unknown;
  error?: string;
  error_code?: string;
}

export interface StatusResult {
  status: 'pending' | 'successful' | 'failed';
  provider_reference?: string;
  amount?: number;
  currency?: string;
  raw?: unknown;
}

export interface RefundResult {
  success: boolean;
  refund_reference?: string;
  raw?: unknown;
  error?: string;
}

export interface HealthResult {
  healthy: boolean;
  latency_ms?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ConnectorContext {
  credentials: Record<string, string>;
  environment: ConnectorEnvironment;
  country: string;
}

export interface PaymentConnector {
  id: ConnectorId;
  initiateCharge(ctx: ConnectorContext, payload: ChargePayload): Promise<ChargeResult>;
  getStatus(ctx: ConnectorContext, providerReference: string): Promise<StatusResult>;
  refund(ctx: ConnectorContext, providerReference: string, amount?: number): Promise<RefundResult>;
  healthCheck(ctx: ConnectorContext): Promise<HealthResult>;
  requiredCredentialFields(): string[];
}
