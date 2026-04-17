// Unit tests for File bank adapter — CSV parsing, transfer rejection.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { fileBankConnector } from './file-bank.ts';
import type { BankConnectorContext } from './types.ts';

function makeCtx(overrides: Partial<BankConnectorContext> = {}): BankConnectorContext {
  return {
    bank_id: 'bank-test',
    config_id: 'cfg-1',
    credentials: {},
    config: {},
    environment: 'sandbox',
    ...overrides,
  };
}

function stubFetch(textByPath: Record<string, { status: number; body: string }>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: Request | string | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    for (const [needle, resp] of Object.entries(textByPath)) {
      if (url.includes(needle)) return Promise.resolve(new Response(resp.body, { status: resp.status }));
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

Deno.test('file-bank: contract surface', () => {
  assertEquals(fileBankConnector.type, 'file');
  assert(typeof fileBankConnector.initiateTransfer === 'function');
});

Deno.test('file-bank: initiateTransfer rejected', async () => {
  const r = await fileBankConnector.initiateTransfer(makeCtx(), {
    from_account: 'a', to_account: 'b', amount: 100, currency: 'XAF', reference: 'r',
  });
  assertEquals(r.success, false);
  assertEquals(r.status, 'failed');
});

Deno.test('file-bank: parses CSV account row', async () => {
  Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  const csv = [
    'external_account_id,account_holder_name,currency,status',
    'ACC-1,John Doe,XAF,active',
    'ACC-2,Jane Smith,XAF,active',
  ].join('\n');
  const restore = stubFetch({ '/accounts/': { status: 200, body: csv } });
  try {
    const a = await fileBankConnector.getAccountDetails(makeCtx(), 'ACC-2');
    assertEquals(a.external_account_id, 'ACC-2');
    assertEquals(a.account_holder_name, 'Jane Smith');
    assertEquals(a.currency, 'XAF');
  } finally { restore(); }
});

Deno.test('file-bank: parses CSV transactions filtered by account', async () => {
  Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  const csv = [
    'external_tx_id,account_id,booking_date,amount,currency,credit_debit,reference',
    'T1,ACC-1,2026-01-01,500,XAF,Credit,REF1',
    'T2,ACC-2,2026-01-01,200,XAF,Debit,REF2',
    'T3,ACC-1,2026-01-02,150,XAF,Credit,REF3',
  ].join('\n');
  const restore = stubFetch({ '/transactions/': { status: 200, body: csv } });
  try {
    const txs = await fileBankConnector.getTransactions(makeCtx(), 'ACC-1', { from: '2026-01-01', to: '2026-01-31' });
    assertEquals(txs.length, 2);
    assertEquals(txs[0].external_tx_id, 'T1');
    assertEquals(txs[0].credit_debit, 'Credit');
    assertEquals(txs[1].external_tx_id, 'T3');
  } finally { restore(); }
});

Deno.test('file-bank: missing transaction file returns empty array (not error)', async () => {
  Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  const restore = stubFetch({}); // every path 404s
  try {
    const txs = await fileBankConnector.getTransactions(makeCtx(), 'X', { from: '2026-01-01', to: '2026-01-31' });
    assertEquals(txs.length, 0);
  } finally { restore(); }
});

Deno.test('file-bank: balance row parsed as number', async () => {
  Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  const csv = [
    'account_id,amount,currency,balance_type',
    'ACC-1,12345.67,XAF,ClosingAvailable',
  ].join('\n');
  const restore = stubFetch({ '/balances/': { status: 200, body: csv } });
  try {
    const b = await fileBankConnector.getBalance(makeCtx(), 'ACC-1');
    assertEquals(b.amount, 12345.67);
    assertEquals(b.balance_type, 'ClosingAvailable');
  } finally { restore(); }
});
