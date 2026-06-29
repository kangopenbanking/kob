// ============================================================
// @kangopenbanking/sdk — Nium extended resources
// Aligned with OpenAPI v4.52.0 — /v1/gateway/nium/*
// Additive only (Standing Orders 1, 2, 4).
// ============================================================

import type { KangOpenBanking } from './client';

export type NiumCurrency =
  | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED' | 'JPY'
  | 'INR' | 'ZAR' | 'HKD' | 'CHF' | 'NZD' | 'SEK' | 'NOK' | 'DKK' | 'CNY';

export type NiumAccountKind = 'virtual' | 'global';

export interface NiumBeneficiary {
  id: string;
  user_id: string;
  beneficiary_name: string;
  account_number: string;
  currency: NiumCurrency | 'XAF';
  bank_name?: string | null;
  bic?: string | null;
  iban?: string | null;
  country?: string | null;
  status: 'active' | 'pending' | 'rejected';
  created_at: string;
}

export interface NiumPayout {
  id: string;
  beneficiary_id: string;
  source_currency: NiumCurrency;
  destination_currency: NiumCurrency | 'XAF';
  source_amount: number;
  destination_amount: number;
  fx_rate: number;
  purpose_code: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  idempotency_key: string;
  created_at: string;
}

export interface NiumConversion {
  id: string;
  from_currency: NiumCurrency;
  to_currency: NiumCurrency;
  from_amount: number;
  to_amount: number;
  fx_rate: number;
  status: 'pending' | 'completed' | 'failed';
  idempotency_key: string;
  created_at: string;
}

export interface NiumRfi {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'responded' | 'closed';
  requested_at: string;
  responded_at?: string | null;
  documents?: string[];
}

export class BeneficiariesResource {
  constructor(private c: KangOpenBanking) {}
  list(): Promise<{ beneficiaries: NiumBeneficiary[] }> {
    return this.c.request('GET', 'nium-beneficiaries');
  }
  create(params: {
    beneficiary_name: string;
    account_number: string;
    currency: NiumCurrency | 'XAF';
    bic?: string;
    iban?: string;
    bank_name?: string;
    country?: string;
  }): Promise<{ beneficiary: NiumBeneficiary; reused: boolean }> {
    return this.c.request('POST', 'nium-beneficiaries', params);
  }
}

export class PayoutsResource {
  constructor(private c: KangOpenBanking) {}
  list(): Promise<{ payouts: NiumPayout[] }> {
    return this.c.request('GET', 'nium-payouts');
  }
  /** Requires UUID v4 Idempotency-Key. Auto-quotes FX when source ≠ destination. */
  create(params: {
    beneficiary_id: string;
    source_currency: NiumCurrency;
    destination_currency: NiumCurrency | 'XAF';
    source_amount: number;
    purpose_code: string;
    idempotency_key: string;
  }): Promise<{ payout: NiumPayout }> {
    return this.c.request('POST', 'nium-payouts', params, {
      'Idempotency-Key': params.idempotency_key,
    });
  }
}

export class ConversionsResource {
  constructor(private c: KangOpenBanking) {}
  list(): Promise<{ conversions: NiumConversion[] }> {
    return this.c.request('GET', 'nium-conversions');
  }
  create(params: {
    from_currency: NiumCurrency;
    to_currency: NiumCurrency;
    from_amount: number;
    idempotency_key: string;
  }): Promise<{ conversion: NiumConversion }> {
    if (params.from_currency === params.to_currency) {
      throw new Error('from_currency must differ from to_currency');
    }
    return this.c.request('POST', 'nium-conversions', params, {
      'Idempotency-Key': params.idempotency_key,
    });
  }
}

export class RfiResource {
  constructor(private c: KangOpenBanking) {}
  list(status?: 'open' | 'responded' | 'closed'): Promise<{ rfis: NiumRfi[] }> {
    return this.c.request('GET', 'nium-rfi', status ? { status } : undefined);
  }
  respond(params: { rfi_id: string; response: string; document_urls?: string[] }): Promise<{ rfi: NiumRfi }> {
    return this.c.request('POST', 'nium-rfi', params);
  }
}
