// Generic REST/JSON bank API adapter.
// Configurable endpoint paths and auth method per bank.

import type {
  BankConnector,
  BankConnectorContext,
  BankAccountDetails,
  BankBalance,
  BankTransaction,
  TransferPayload,
  TransferResult,
  ReconcileResult,
  BankHealthResult,
  DateRange,
} from './types.ts';

interface RestConfig {
  base_url: string;
  auth_method?: 'bearer' | 'basic' | 'api_key' | 'none';
  paths?: {
    account?: string;       // e.g. /accounts/{id}
    balance?: string;       // e.g. /accounts/{id}/balance
    transactions?: string;  // e.g. /accounts/{id}/transactions?from={from}&to={to}
    transfer?: string;      // e.g. /transfers
    health?: string;        // e.g. /health
  };
  timeout_ms?: number;
}

function buildHeaders(creds: Record<string, string>, method?: string): Headers {
  const h = new Headers({ 'Content-Type': 'application/json', 'Accept': 'application/json' });
  if (method === 'bearer' && creds.token) h.set('Authorization', `Bearer ${creds.token}`);
  else if (method === 'basic' && creds.username && creds.password) {
    h.set('Authorization', `Basic ${btoa(`${creds.username}:${creds.password}`)}`);
  } else if (method === 'api_key' && creds.api_key) {
    h.set(creds.api_key_header || 'X-API-Key', creds.api_key);
  }
  return h;
}

function expandPath(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ''));
}

async function call(ctx: BankConnectorContext, path: string, init?: RequestInit): Promise<unknown> {
  const cfg = ctx.config as RestConfig;
  if (!cfg.base_url) throw new Error('REST adapter: base_url required');
  const url = `${cfg.base_url.replace(/\/$/, '')}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.timeout_ms ?? 15000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: buildHeaders(ctx.credentials, cfg.auth_method),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`REST ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const restBankConnector: BankConnector = {
  type: 'rest',
  requiredCredentialFields: () => [],
  requiredConfigFields: () => ['base_url'],

  async getAccountDetails(ctx, id): Promise<BankAccountDetails> {
    const cfg = ctx.config as RestConfig;
    const path = expandPath(cfg.paths?.account ?? '/accounts/{id}', { id });
    const raw = await call(ctx, path) as Record<string, unknown>;
    return {
      external_account_id: String(raw.id ?? id),
      account_holder_name: raw.holder_name as string | undefined,
      account_type: raw.type as string | undefined,
      identification_scheme: raw.scheme as string | undefined,
      identification_value: raw.identification as string | undefined,
      currency: (raw.currency as string) ?? 'XAF',
      status: raw.status as string | undefined,
      raw,
    };
  },

  async getBalance(ctx, id): Promise<BankBalance> {
    const cfg = ctx.config as RestConfig;
    const path = expandPath(cfg.paths?.balance ?? '/accounts/{id}/balance', { id });
    const raw = await call(ctx, path) as Record<string, unknown>;
    return {
      account_id: id,
      amount: Number(raw.amount ?? 0),
      currency: (raw.currency as string) ?? 'XAF',
      balance_type: (raw.balance_type as string) ?? 'ClosingAvailable',
      as_of_datetime: (raw.as_of as string) ?? new Date().toISOString(),
      raw,
    };
  },

  async getTransactions(ctx, id, range): Promise<BankTransaction[]> {
    const cfg = ctx.config as RestConfig;
    const path = expandPath(cfg.paths?.transactions ?? '/accounts/{id}/transactions?from={from}&to={to}', {
      id, from: range.from, to: range.to,
    });
    const raw = await call(ctx, path) as { transactions?: Record<string, unknown>[] } | Record<string, unknown>[];
    const list = Array.isArray(raw) ? raw : (raw.transactions ?? []);
    return list.map((t) => ({
      external_tx_id: String(t.id ?? t.tx_id ?? ''),
      account_id: id,
      booking_date: String(t.booking_date ?? t.date ?? ''),
      value_date: t.value_date as string | undefined,
      amount: Number(t.amount ?? 0),
      currency: (t.currency as string) ?? 'XAF',
      credit_debit: ((t.credit_debit ?? t.type ?? 'Credit') as string).toLowerCase().includes('deb') ? 'Debit' : 'Credit',
      reference: t.reference as string | undefined,
      description: t.description as string | undefined,
      raw: t,
    }));
  },

  async initiateTransfer(ctx, payload): Promise<TransferResult> {
    const cfg = ctx.config as RestConfig;
    const path = cfg.paths?.transfer ?? '/transfers';
    try {
      const raw = await call(ctx, path, { method: 'POST', body: JSON.stringify(payload) }) as Record<string, unknown>;
      const status = String(raw.status ?? 'pending').toLowerCase();
      return {
        success: status !== 'failed',
        bank_tx_id: raw.id as string | undefined,
        status: status === 'executed' || status === 'completed' ? 'executed' : status === 'failed' ? 'failed' : 'pending',
        raw,
      };
    } catch (e) {
      return { success: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  },

  async reconcile(_ctx, _range): Promise<ReconcileResult> {
    // REST adapter delegates reconciliation to bank-reconcile edge function
    return { total_compared: 0, matched: 0, missing_in_kob: 0, missing_in_bank: 0, amount_mismatches: 0 };
  },

  async healthCheck(ctx): Promise<BankHealthResult> {
    const cfg = ctx.config as RestConfig;
    const start = Date.now();
    try {
      await call(ctx, cfg.paths?.health ?? '/health');
      return { healthy: true, latency_ms: Date.now() - start };
    } catch (e) {
      return { healthy: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
