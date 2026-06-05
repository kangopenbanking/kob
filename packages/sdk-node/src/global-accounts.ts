// ============================================================
// @kangopenbanking/sdk — GlobalAccountsResource (Nium-powered)
// Aligned with OpenAPI v4.50.0 — /v1/gateway/global-accounts*
// ============================================================

import type { KangOpenBanking } from './client';

export type GlobalAccountCurrency = 'USD' | 'EUR' | 'GBP';
export type GlobalAccountStatus = 'active' | 'suspended' | 'closed';
export type PayoutPreference = 'KANG_WALLET' | 'MOBILE_MONEY';
export type NiumMode = 'stub' | 'sandbox' | 'live';

export interface NiumGlobalAccount {
  id: string;
  currency: GlobalAccountCurrency;
  iban: string | null;
  account_number: string | null;
  routing_code: string | null;
  bic: string | null;
  bank_name: string;
  bank_address: string | null;
  beneficiary_name: string;
  status: GlobalAccountStatus;
  payout_preference_override: PayoutPreference | null;
  payout_channel_override: string | null;
  mode: NiumMode;
}

export interface NiumIncomingPayment {
  id: string;
  source_amount: number;
  source_currency: string;
  fx_rate_nium: number;
  fx_spread_bps: number;
  xaf_gross: number;
  xaf_spread_revenue: number;
  xaf_withdrawal_fee: number;
  xaf_net_credited: number;
  routing: PayoutPreference;
  status:
    | 'received'
    | 'credited'
    | 'payout_pending'
    | 'payout_completed'
    | 'payout_failed'
    | 'failed';
  created_at: string;
}

export interface NiumPayoutPreferenceDefaults {
  payout_preference: PayoutPreference;
  payout_channel: string | null;
}

export interface ListGlobalAccountsResponse {
  accounts: NiumGlobalAccount[];
  incoming_payments: NiumIncomingPayment[];
  user_defaults: NiumPayoutPreferenceDefaults;
}

export interface CreateGlobalAccountRequest {
  currency: GlobalAccountCurrency;
  beneficiary_name?: string;
}

export interface CreateGlobalAccountResponse {
  account: NiumGlobalAccount;
  reused: boolean;
}

export type UpdatePayoutPreferenceRequest =
  | {
      scope: 'user';
      payout_preference: PayoutPreference;
      /** Required when payout_preference = MOBILE_MONEY (E.164 phone). */
      payout_channel?: string;
    }
  | {
      scope: 'account';
      account_id: string;
      /** Pass null to clear the per-account override. */
      payout_preference_override?: PayoutPreference | null;
      payout_channel_override?: string | null;
    };

export class GlobalAccountsResource {
  constructor(private client: KangOpenBanking) {}

  /** POST /v1/gateway/global-accounts — idempotent per (user, currency). */
  async create(params: CreateGlobalAccountRequest): Promise<CreateGlobalAccountResponse> {
    return this.client.request('POST', 'nium-create-global-account', params);
  }

  /** GET /v1/gateway/global-accounts — accounts + recent incoming payments + user defaults. */
  async list(): Promise<ListGlobalAccountsResponse> {
    return this.client.request('GET', 'nium-list-global-accounts');
  }

  /** PATCH /v1/gateway/global-accounts/payout-preference — user default or per-account override. */
  async updatePayoutPreference(params: UpdatePayoutPreferenceRequest): Promise<{ ok: true }> {
    return this.client.request('PATCH', 'nium-update-payout-preference', params);
  }

  /**
   * Verify a Nium webhook signature (HMAC-SHA256 of the raw request body,
   * sent in the `x-nium-signature` header).
   */
  static async verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hex.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < hex.length; i++) mismatch |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
    return mismatch === 0;
  }
}
