// SQL bank adapter — read-only, parameterized queries ONLY.
// Wave 5B: real reconcile() using shared matcher.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
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
import { matchTransactions, type LedgerTransaction } from './reconciliation-matcher.ts';

interface SqlConfig {
  gateway_url: string;
  db_type?: 'postgres' | 'mysql' | 'oracle';
  schema?: string;
  timeout_ms?: number;
  reconcile_account_ids?: string[];
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

async function fetchLedgerTxs(bank_id: string, range: DateRange): Promise<LedgerTransaction[]> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return [];
  const admin = createClient(url, key);
  const { data } = await admin
    .from('bank_side_transactions')
    .select('id, external_tx_id, amount, currency, credit_debit, booking_date, reference')
    .eq('bank_id', bank_id)
    .gte('booking_date', range.from.slice(0, 10))
    .lte('booking_date', range.to.slice(0, 10));
  return (data ?? []).map((r: any) => ({
    id: r.id,
    external_reference: r.reference ?? r.external_tx_id ?? null,
    amount: Number(r.amount),
    currency: r.currency,
    credit_debit: r.credit_debit,
    booking_date: r.booking_date,
  }));
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
    return { success: false, status: 'failed', error: 'SQL adapter is read-only; transfers not supported' };
  },

  async reconcile(ctx, range): Promise<ReconcileResult> {
    const cfg = ctx.config as unknown as SqlConfig;
    const accountIds = cfg.reconcile_account_ids ?? [];
    const allBankTxs: BankTransaction[] = [];
    for (const acctId of accountIds) {
      try {
        const txs = await this.getTransactions(ctx, acctId, range);
        allBankTxs.push(...txs);
      } catch { /* per-account failure tolerated */ }
    }
    const ledgerTxs = await fetchLedgerTxs(ctx.bank_id, range);
    return matchTransactions({ bankTxs: allBankTxs, ledgerTxs });
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
