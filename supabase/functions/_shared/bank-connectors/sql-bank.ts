// SQL bank adapter — read-only, parameterized queries ONLY.
// Connects to a bank-supplied PostgreSQL/MySQL replica via HTTPS query gateway.
//
// SECURITY: Per project rules, no raw SQL is accepted from clients. The bank
// supplies a fixed query gateway URL that exposes 4 named operations
// (account, balance, transactions, beneficiaries) with positional parameters.
// We never construct SQL strings dynamically.

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

interface SqlConfig {
  gateway_url: string;     // bank-hosted query gateway (HTTPS)
  db_type?: 'postgres' | 'mysql' | 'oracle';
  schema?: string;
  timeout_ms?: number;
}

interface QueryRequest {
  operation: 'account' | 'balance' | 'transactions' | 'health';
  params: Record<string, string | number | null>;
}

async function query(ctx: BankConnectorContext, req: QueryRequest): Promise<unknown> {
  const cfg = ctx.config as unknown as SqlConfig;
  if (!cfg.gateway_url) throw new Error('SQL adapter: gateway_url required');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.timeout_ms ?? 20000);
  try {
    const res = await fetch(cfg.gateway_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ctx.credentials.gateway_token ?? ''}`,
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`SQL gateway ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const sqlBankConnector: BankConnector = {
  type: 'sql',
  requiredCredentialFields: () => ['gateway_token'],
  requiredConfigFields: () => ['gateway_url'],

  async getAccountDetails(ctx, id): Promise<BankAccountDetails> {
    const row = await query(ctx, { operation: 'account', params: { account_id: id } }) as Record<string, unknown>;
    return {
      external_account_id: String(row.external_account_id ?? id),
      account_holder_name: row.holder_name as string | undefined,
      account_type: row.account_type as string | undefined,
      identification_scheme: row.scheme as string | undefined,
      identification_value: row.identification as string | undefined,
      currency: (row.currency as string) ?? 'XAF',
      status: row.status as string | undefined,
      raw: row,
    };
  },

  async getBalance(ctx, id): Promise<BankBalance> {
    const row = await query(ctx, { operation: 'balance', params: { account_id: id } }) as Record<string, unknown>;
    return {
      account_id: id,
      amount: Number(row.amount ?? 0),
      currency: (row.currency as string) ?? 'XAF',
      balance_type: (row.balance_type as string) ?? 'ClosingAvailable',
      as_of_datetime: (row.as_of_datetime as string) ?? new Date().toISOString(),
      raw: row,
    };
  },

  async getTransactions(ctx, id, range): Promise<BankTransaction[]> {
    const rows = await query(ctx, {
      operation: 'transactions',
      params: { account_id: id, from_date: range.from, to_date: range.to, watermark: ctx.watermark ?? null },
    }) as Record<string, unknown>[];
    return (rows ?? []).map((t) => ({
      external_tx_id: String(t.external_tx_id ?? t.id ?? ''),
      account_id: id,
      booking_date: String(t.booking_date ?? ''),
      value_date: t.value_date as string | undefined,
      amount: Number(t.amount ?? 0),
      currency: (t.currency as string) ?? 'XAF',
      credit_debit: ((t.credit_debit ?? 'Credit') as string).toLowerCase().includes('deb') ? 'Debit' : 'Credit',
      reference: t.reference as string | undefined,
      description: t.description as string | undefined,
      raw: t,
    }));
  },

  async initiateTransfer(_ctx, _payload): Promise<TransferResult> {
    // SQL adapter is READ-ONLY by policy. Transfers must use REST or SOAP adapters.
    return { success: false, status: 'failed', error: 'SQL adapter is read-only; transfers not supported' };
  },

  async reconcile(_ctx, _range): Promise<ReconcileResult> {
    return { total_compared: 0, matched: 0, missing_in_kob: 0, missing_in_bank: 0, amount_mismatches: 0 };
  },

  async healthCheck(ctx): Promise<BankHealthResult> {
    const start = Date.now();
    try {
      await query(ctx, { operation: 'health', params: {} });
      return { healthy: true, latency_ms: Date.now() - start };
    } catch (e) {
      return { healthy: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
