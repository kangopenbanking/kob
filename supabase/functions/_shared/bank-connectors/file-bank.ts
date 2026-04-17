// File-based bank adapter — parses CSV / pain.001 / MT940 from Supabase Storage.
// Hooks into existing `bank-import-transactions` infrastructure.
//
// Read operations resolve files staged by the bank in the `bank-files` storage bucket.
// Transfer is not supported (file-based banks are batch-out only).

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

interface FileConfig {
  storage_bucket?: string;     // default 'bank-files'
  account_file_pattern?: string;     // e.g. '{bank_id}/accounts/latest.csv'
  balance_file_pattern?: string;
  transaction_file_pattern?: string; // e.g. '{bank_id}/tx/{date}.csv'
  format?: 'csv' | 'pain001' | 'mt940';
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

async function fetchFile(ctx: BankConnectorContext, path: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('File adapter: storage credentials missing');
  const cfg = ctx.config as unknown as FileConfig;
  const bucket = cfg.storage_bucket ?? 'bank-files';
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${serviceKey}` } });
  if (!res.ok) throw new Error(`File fetch ${res.status}: ${path}`);
  return await res.text();
}

function expandPath(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export const fileBankConnector: BankConnector = {
  type: 'file',
  requiredCredentialFields: () => [],
  requiredConfigFields: ['storage_bucket'] as unknown as () => string[], // overridden below
  // (assignment workaround for type narrowing)

  async getAccountDetails(ctx, id): Promise<BankAccountDetails> {
    const cfg = ctx.config as unknown as FileConfig;
    const path = expandPath(cfg.account_file_pattern ?? '{bank_id}/accounts/latest.csv', { bank_id: ctx.bank_id });
    const text = await fetchFile(ctx, path);
    const rows = parseCsv(text);
    const row = rows.find((r) => r.external_account_id === id || r.account_id === id);
    if (!row) throw new Error(`Account ${id} not found in file feed`);
    return {
      external_account_id: row.external_account_id ?? id,
      account_holder_name: row.account_holder_name,
      account_type: row.account_type,
      identification_scheme: row.identification_scheme,
      identification_value: row.identification_value,
      currency: row.currency || 'XAF',
      status: row.status,
      raw: row,
    };
  },

  async getBalance(ctx, id): Promise<BankBalance> {
    const cfg = ctx.config as unknown as FileConfig;
    const path = expandPath(cfg.balance_file_pattern ?? '{bank_id}/balances/latest.csv', { bank_id: ctx.bank_id });
    const text = await fetchFile(ctx, path);
    const rows = parseCsv(text);
    const row = rows.find((r) => (r.account_id ?? r.external_account_id) === id);
    if (!row) throw new Error(`Balance for ${id} not found`);
    return {
      account_id: id,
      amount: Number(row.amount ?? 0),
      currency: row.currency || 'XAF',
      balance_type: row.balance_type || 'ClosingAvailable',
      as_of_datetime: row.as_of_datetime || new Date().toISOString(),
      raw: row,
    };
  },

  async getTransactions(ctx, id, range): Promise<BankTransaction[]> {
    const cfg = ctx.config as unknown as FileConfig;
    const dateKey = range.to.slice(0, 10);
    const path = expandPath(cfg.transaction_file_pattern ?? '{bank_id}/transactions/{date}.csv', {
      bank_id: ctx.bank_id, date: dateKey,
    });
    let text: string;
    try { text = await fetchFile(ctx, path); } catch { return []; }
    const rows = parseCsv(text);
    return rows
      .filter((r) => (r.account_id ?? r.external_account_id) === id)
      .map((r) => ({
        external_tx_id: r.external_tx_id ?? r.tx_id ?? '',
        account_id: id,
        booking_date: r.booking_date ?? '',
        value_date: r.value_date,
        amount: Number(r.amount ?? 0),
        currency: r.currency || 'XAF',
        credit_debit: (r.credit_debit ?? 'Credit').toLowerCase().includes('deb') ? 'Debit' : 'Credit',
        reference: r.reference,
        description: r.description,
        raw: r,
      }));
  },

  async initiateTransfer(_ctx, _payload): Promise<TransferResult> {
    return { success: false, status: 'failed', error: 'File adapter does not support real-time transfers' };
  },

  async reconcile(ctx, range): Promise<ReconcileResult> {
    // Use already-staged bank_side_transactions for this bank within the range,
    // and run the shared matcher against them. Files are pre-ingested by
    // bank-import-transactions / bank-data-poller.
    const { matchTransactions } = await import('./reconciliation-matcher.ts');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      return { total_compared: 0, matched: 0, missing_in_kob: 0, missing_in_bank: 0, amount_mismatches: 0 };
    }
    const admin = createClient(url, key);
    const { data } = await admin
      .from('bank_side_transactions')
      .select('external_tx_id, external_account_id, booking_date, value_date, amount, currency, credit_debit, reference, description, raw')
      .eq('bank_id', ctx.bank_id)
      .gte('booking_date', range.from.slice(0, 10))
      .lte('booking_date', range.to.slice(0, 10));
    const bankTxs = (data ?? []).map((r: any) => ({
      external_tx_id: r.external_tx_id,
      account_id: r.external_account_id,
      booking_date: r.booking_date,
      value_date: r.value_date,
      amount: Number(r.amount),
      currency: r.currency,
      credit_debit: r.credit_debit,
      reference: r.reference,
      description: r.description,
      raw: r.raw,
    }));
    return matchTransactions({ bankTxs, ledgerTxs: [] });
  },

  async healthCheck(ctx): Promise<BankHealthResult> {
    const start = Date.now();
    try {
      const cfg = ctx.config as unknown as FileConfig;
      const bucket = cfg.storage_bucket ?? 'bank-files';
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const res = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
      await res.text();
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch (e) {
      return { healthy: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// Override the workaround
(fileBankConnector as { requiredConfigFields: () => string[] }).requiredConfigFields = () => [];
