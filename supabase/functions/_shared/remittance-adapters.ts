/**
 * Remittance Provider Adapters — Unified interface for Thunes, TerraPay, Onafriq
 * Follows the gateway-adapters.ts pattern: typed interfaces, status mappers, per-provider functions.
 */

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;

// ─── Canonical Types ───

export interface CanonicalRemittanceEvent {
  partner_reference: string;
  event_type: 'received' | 'credited' | 'settled' | 'failed' | 'reversed';
  amount_in: number;
  currency_in: string;
  amount_out: number;
  currency_out: string;
  fx_rate: number;
  fee_total: number;
  sender_name?: string;
  sender_country?: string;
  sender_phone?: string;
  receiver_name: string;
  receiver_phone?: string;
  destination_type?: string;
  destination_ref?: string;
  purpose_code?: string;
  narration?: string;
  raw_payload: Record<string, unknown>;
}

export interface QuoteRequest {
  partner_id: string;
  corridor_id?: string;
  amount_in: number;
  currency_in: string;
  currency_out?: string;
  receiver_phone?: string;
  destination_type?: string;
}

export interface QuoteResult {
  amount_out: number;
  currency_out: string;
  fx_rate: number;
  fee_total: number;
  expires_at: string;
  quote_raw: Record<string, unknown>;
}

export interface RemittanceStatusResult {
  partner_reference: string;
  status: string;
  provider_raw: Record<string, unknown>;
}

export interface SettlementStatement {
  period_start: string;
  period_end: string;
  currency: string;
  gross_in: number;
  fees: number;
  net_settlement: number;
  items: SettlementLineItem[];
  raw: Record<string, unknown>;
}

export interface SettlementLineItem {
  partner_reference: string;
  amount: number;
  fee: number;
  status: string;
}

// ─── Status Mapping ───

export function mapThunesStatus(status: string): string {
  const map: Record<string, string> = {
    '10100': 'pending',
    '20000': 'received',
    '30000': 'credited',
    '50000': 'failed',
    '60000': 'reversed',
    submitted: 'pending',
    available: 'received',
    delivered: 'credited',
    completed: 'settled',
    rejected: 'failed',
    returned: 'reversed',
    cancelled: 'failed',
  };
  return map[status?.toLowerCase()] || 'pending';
}

export function mapTerraPayStatus(status: string): string {
  const map: Record<string, string> = {
    '3000': 'received',
    '3001': 'credited',
    '3002': 'settled',
    '5000': 'failed',
    '5001': 'reversed',
    COMPLETED: 'credited',
    PENDING: 'pending',
    FAILED: 'failed',
    REVERSED: 'reversed',
    SETTLED: 'settled',
  };
  return map[status?.toUpperCase?.()] || map[status] || 'pending';
}

export function mapOnafriqStatus(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'credited',
    PENDING: 'pending',
    PROCESSING: 'received',
    FAILED: 'failed',
    REVERSED: 'reversed',
    SETTLED: 'settled',
  };
  return map[status?.toUpperCase()] || 'pending';
}

export function mapGenericStatus(status: string): string {
  const n = status?.toLowerCase();
  if (['completed', 'delivered', 'credited', 'success'].includes(n)) return 'credited';
  if (['settled', 'reconciled'].includes(n)) return 'settled';
  if (['available', 'received', 'ready'].includes(n)) return 'received';
  if (['failed', 'rejected', 'error', 'cancelled'].includes(n)) return 'failed';
  if (['reversed', 'returned', 'refunded'].includes(n)) return 'reversed';
  return 'pending';
}

// ─── HMAC Verification Helper ───

async function hmacSha256Verify(
  secret: string,
  payload: string,
  expectedSignature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === expectedSignature.toLowerCase();
}

// ─── Thunes Adapter ───

export function thunesVerifyWebhook(headers: Headers, rawBody: string, secret: string): Promise<boolean> {
  const signature = headers.get('x-thunes-signature') || '';
  const timestamp = headers.get('x-thunes-timestamp') || '';
  return hmacSha256Verify(secret, `${timestamp}.${rawBody}`, signature);
}

export function thunesParseEvent(rawBody: string): CanonicalRemittanceEvent {
  const data = JSON.parse(rawBody);
  const txn = data.transaction || data;
  return {
    partner_reference: txn.external_id || txn.id?.toString() || '',
    event_type: mapThunesStatus(txn.status?.toString() || '') as CanonicalRemittanceEvent['event_type'],
    amount_in: parseFloat(txn.source?.amount || txn.sent_amount?.amount || '0'),
    currency_in: txn.source?.currency || txn.sent_amount?.currency || '',
    amount_out: parseFloat(txn.destination?.amount || txn.received_amount?.amount || '0'),
    currency_out: txn.destination?.currency || txn.received_amount?.currency || 'XAF',
    fx_rate: parseFloat(txn.wholesale_fx_rate || txn.exchange_rate || '1'),
    fee_total: parseFloat(txn.fee?.amount || '0'),
    sender_name: txn.sender?.lastname
      ? `${txn.sender.firstname} ${txn.sender.lastname}`
      : txn.sender_name,
    sender_country: txn.sender?.country_iso_code || txn.source_country,
    receiver_name: txn.beneficiary?.lastname
      ? `${txn.beneficiary.firstname} ${txn.beneficiary.lastname}`
      : txn.receiver_name || '',
    receiver_phone: txn.beneficiary?.mobile_number || txn.receiver_phone,
    destination_type: txn.service_id === 'mobile_wallet' ? 'kob_wallet' : 'bank_account',
    destination_ref: txn.beneficiary?.account_number || txn.destination_ref,
    purpose_code: txn.purpose_of_remittance,
    narration: txn.additional_information || txn.description,
    raw_payload: data,
  };
}

export async function thunesFetchStatus(partnerRef: string): Promise<RemittanceStatusResult> {
  const apiKey = typeof Deno !== 'undefined' ? Deno.env.get('THUNES_API_KEY') : undefined;
  const apiSecret = typeof Deno !== 'undefined' ? Deno.env.get('THUNES_API_SECRET') : undefined;
  if (!apiKey || !apiSecret) throw new Error('THUNES credentials not configured');

  const env = typeof Deno !== 'undefined' ? Deno.env.get('THUNES_ENVIRONMENT') : 'production';
  const baseUrl = env === 'sandbox' ? 'https://api-mt.pre.thunes.com' : 'https://api-mt.thunes.com';

  const res = await fetch(`${baseUrl}/v2/money-transfer/transactions/${partnerRef}`, {
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json();
  return { partner_reference: partnerRef, status: mapThunesStatus(data.status?.toString() || ''), provider_raw: data };
}

// ─── TerraPay Adapter ───

export function terraPayVerifyWebhook(headers: Headers, rawBody: string, secret: string): Promise<boolean> {
  const signature = headers.get('x-terrapay-signature') || '';
  return hmacSha256Verify(secret, rawBody, signature);
}

export function terraPayParseEvent(rawBody: string): CanonicalRemittanceEvent {
  const data = JSON.parse(rawBody);
  const txn = data.transaction || data;
  return {
    partner_reference: txn.transactionId || txn.partnerTransactionId || '',
    event_type: mapTerraPayStatus(txn.transactionStatus || txn.status || '') as CanonicalRemittanceEvent['event_type'],
    amount_in: parseFloat(txn.sendAmount || txn.sourceAmount || '0'),
    currency_in: txn.sendCurrency || txn.sourceCurrency || '',
    amount_out: parseFloat(txn.receiveAmount || txn.destinationAmount || '0'),
    currency_out: txn.receiveCurrency || txn.destinationCurrency || 'XAF',
    fx_rate: parseFloat(txn.exchangeRate || '1'),
    fee_total: parseFloat(txn.fee || txn.totalFee || '0'),
    sender_name: txn.senderName || `${txn.senderFirstName || ''} ${txn.senderLastName || ''}`.trim(),
    sender_country: txn.senderCountry || txn.sourceCountry,
    receiver_name: txn.receiverName || `${txn.receiverFirstName || ''} ${txn.receiverLastName || ''}`.trim(),
    receiver_phone: txn.receiverMobileNumber || txn.beneficiaryPhone,
    destination_type: txn.paymentMode === 'WALLET' ? 'kob_wallet' : 'bank_account',
    destination_ref: txn.receiverAccountNumber,
    purpose_code: txn.purposeCode,
    narration: txn.remarks,
    raw_payload: data,
  };
}

// ─── Onafriq Adapter ───

export function onafriqVerifyWebhook(headers: Headers, rawBody: string, secret: string): Promise<boolean> {
  const signature = headers.get('x-onafriq-signature') || headers.get('x-mfs-signature') || '';
  return hmacSha256Verify(secret, rawBody, signature);
}

export function onafriqParseEvent(rawBody: string): CanonicalRemittanceEvent {
  const data = JSON.parse(rawBody);
  const txn = data.payload || data;
  return {
    partner_reference: txn.reference || txn.transactionReference || '',
    event_type: mapOnafriqStatus(txn.status || '') as CanonicalRemittanceEvent['event_type'],
    amount_in: parseFloat(txn.sendAmount || '0'),
    currency_in: txn.sendCurrency || '',
    amount_out: parseFloat(txn.receiveAmount || '0'),
    currency_out: txn.receiveCurrency || 'XAF',
    fx_rate: parseFloat(txn.exchangeRate || '1'),
    fee_total: parseFloat(txn.totalFee || '0'),
    sender_name: txn.senderFullName || txn.sender?.name || '',
    sender_country: txn.originCountry,
    receiver_name: txn.receiverFullName || txn.receiver?.name || '',
    receiver_phone: txn.receiverPhone || txn.receiver?.mobile,
    destination_type: 'kob_wallet',
    destination_ref: txn.receiverAccountId,
    purpose_code: txn.purposeCode,
    narration: txn.description,
    raw_payload: data,
  };
}

// ─── Generic / Sandbox Adapter ───

export function genericVerifyWebhook(headers: Headers, rawBody: string, secret: string): Promise<boolean> {
  const signature = headers.get('x-kob-remittance-signature') || '';
  const timestamp = headers.get('x-kob-remittance-timestamp') || '';
  return hmacSha256Verify(secret, `${timestamp}.${rawBody}`, signature);
}

export function genericParseEvent(rawBody: string): CanonicalRemittanceEvent {
  const data = JSON.parse(rawBody);
  return {
    partner_reference: data.partner_reference || data.reference || '',
    event_type: mapGenericStatus(data.status || '') as CanonicalRemittanceEvent['event_type'],
    amount_in: data.amount_in || 0,
    currency_in: data.currency_in || 'EUR',
    amount_out: data.amount_out || 0,
    currency_out: data.currency_out || 'XAF',
    fx_rate: data.fx_rate || 1,
    fee_total: data.fee_total || 0,
    sender_name: data.sender_name,
    sender_country: data.sender_country,
    receiver_name: data.receiver_name || 'Unknown',
    receiver_phone: data.receiver_phone,
    destination_type: data.destination_type || 'kob_wallet',
    destination_ref: data.destination_ref,
    purpose_code: data.purpose_code,
    narration: data.narration,
    raw_payload: data,
  };
}

// ─── Provider Registry (dispatch table) ───

export interface RemittanceProviderAdapter {
  verifyWebhook: (headers: Headers, rawBody: string, secret: string) => Promise<boolean>;
  parseEvent: (rawBody: string) => CanonicalRemittanceEvent;
  statusMapper: (status: string) => string;
}

export const REMITTANCE_PROVIDERS: Record<string, RemittanceProviderAdapter> = {
  thunes: { verifyWebhook: thunesVerifyWebhook, parseEvent: thunesParseEvent, statusMapper: mapThunesStatus },
  terrapay: { verifyWebhook: terraPayVerifyWebhook, parseEvent: terraPayParseEvent, statusMapper: mapTerraPayStatus },
  onafriq: { verifyWebhook: onafriqVerifyWebhook, parseEvent: onafriqParseEvent, statusMapper: mapOnafriqStatus },
  generic: { verifyWebhook: genericVerifyWebhook, parseEvent: genericParseEvent, statusMapper: mapGenericStatus },
};

export function getRemittanceProvider(name: string): RemittanceProviderAdapter {
  const provider = REMITTANCE_PROVIDERS[name.toLowerCase()];
  if (!provider) throw new Error(`Unknown remittance provider: ${name}`);
  return provider;
}

// ─── Ledger Account Codes for Remittance ───

export const REMITTANCE_LEDGER_CODES = {
  CLEARING: 'REMIT-CLEARING',          // Asset: funds received from partner, not yet credited
  FX_GAIN_LOSS: 'REMIT-FX',            // Revenue/Expense: FX margin
  FEE_REVENUE: 'REMIT-FEE-REV',        // Revenue: KOB fee from remittance
  CUSTOMER_WALLET: 'CUST-WALLET',       // Liability: customer wallet balance
  BANK_PAYABLE: 'REMIT-BANK-PAYABLE',   // Liability: pending bank credit
  MERCHANT_PAYABLE: 'REMIT-MERCH-PAY',  // Liability: pending merchant/bill credit
  SETTLEMENT_RECEIVABLE: 'REMIT-SETT',  // Asset: amount due from partner
} as const;
