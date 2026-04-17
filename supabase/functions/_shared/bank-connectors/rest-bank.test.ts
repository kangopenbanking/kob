// Unit tests for REST bank adapter — auth header injection, parsing, error mapping.
// Hermetic: stubs global fetch.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { restBankConnector } from './rest-bank.ts';
import type { BankConnectorContext } from './types.ts';

function makeCtx(overrides: Partial<BankConnectorContext> = {}): BankConnectorContext {
  return {
    bank_id: 'bank-1',
    config_id: 'cfg-1',
    credentials: { token: 'secret-token' },
    config: { base_url: 'https://bank.example.test', auth_method: 'bearer' },
    environment: 'sandbox',
    ...overrides,
  };
}

function stubFetch(handler: (req: Request) => Response | Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

Deno.test('rest-bank: contract surface', () => {
  assertEquals(restBankConnector.type, 'rest');
  assertEquals(restBankConnector.requiredConfigFields(), ['base_url']);
  assert(typeof restBankConnector.initiateTransfer === 'function');
});

Deno.test('rest-bank: injects bearer auth header on getAccountDetails', async () => {
  let seenAuth: string | null = null;
  const restore = stubFetch((req) => {
    seenAuth = req.headers.get('Authorization');
    return new Response(JSON.stringify({ id: 'acc-9', currency: 'XAF' }), { status: 200 });
  });
  try {
    const acc = await restBankConnector.getAccountDetails(makeCtx(), 'acc-9');
    assertEquals(seenAuth, 'Bearer secret-token');
    assertEquals(acc.external_account_id, 'acc-9');
    assertEquals(acc.currency, 'XAF');
  } finally { restore(); }
});

Deno.test('rest-bank: parses JSON array of transactions', async () => {
  const restore = stubFetch(() => new Response(JSON.stringify([
    { id: 't1', date: '2026-01-01', amount: 1500, currency: 'XAF', type: 'credit' },
    { id: 't2', date: '2026-01-02', amount: 750, currency: 'XAF', type: 'debit' },
  ]), { status: 200 }));
  try {
    const txs = await restBankConnector.getTransactions(makeCtx(), 'acc-1', { from: '2026-01-01', to: '2026-01-31' });
    assertEquals(txs.length, 2);
    assertEquals(txs[0].external_tx_id, 't1');
    assertEquals(txs[0].credit_debit, 'Credit');
    assertEquals(txs[1].credit_debit, 'Debit');
  } finally { restore(); }
});

Deno.test('rest-bank: parses {transactions: [...]} envelope', async () => {
  const restore = stubFetch(() => new Response(JSON.stringify({
    transactions: [{ id: 'x', date: '2026-01-01', amount: 1, currency: 'XAF' }],
  }), { status: 200 }));
  try {
    const txs = await restBankConnector.getTransactions(makeCtx(), 'a', { from: '2026-01-01', to: '2026-01-02' });
    assertEquals(txs.length, 1);
  } finally { restore(); }
});

Deno.test('rest-bank: expands {id} {from} {to} in path template', async () => {
  let seenUrl = '';
  const restore = stubFetch((req) => {
    seenUrl = req.url;
    return new Response('[]', { status: 200 });
  });
  try {
    const ctx = makeCtx({ config: {
      base_url: 'https://bank.example.test',
      auth_method: 'bearer',
      paths: { transactions: '/v2/acc/{id}/tx?start={from}&end={to}' },
    } });
    await restBankConnector.getTransactions(ctx, 'ACC-42', { from: '2026-01-01', to: '2026-01-31' });
    assert(seenUrl.includes('/v2/acc/ACC-42/tx'));
    assert(seenUrl.includes('start=2026-01-01'));
    assert(seenUrl.includes('end=2026-01-31'));
  } finally { restore(); }
});

Deno.test('rest-bank: maps 4xx error to thrown Error', async () => {
  const restore = stubFetch(() => new Response('not found', { status: 404 }));
  try {
    let threw = false;
    try { await restBankConnector.getBalance(makeCtx(), 'missing'); }
    catch (e) { threw = true; assert((e as Error).message.includes('404')); }
    assert(threw, 'expected 404 to throw');
  } finally { restore(); }
});

Deno.test('rest-bank: transfer maps failed status', async () => {
  const restore = stubFetch(() => new Response(JSON.stringify({ id: 'tx1', status: 'failed' }), { status: 200 }));
  try {
    const r = await restBankConnector.initiateTransfer(makeCtx(), {
      from_account: 'a', to_account: 'b', amount: 100, currency: 'XAF', reference: 'r1',
    });
    assertEquals(r.success, false);
    assertEquals(r.status, 'failed');
  } finally { restore(); }
});

Deno.test('rest-bank: transfer maps executed/completed status', async () => {
  const restore = stubFetch(() => new Response(JSON.stringify({ id: 'tx2', status: 'completed' }), { status: 200 }));
  try {
    const r = await restBankConnector.initiateTransfer(makeCtx(), {
      from_account: 'a', to_account: 'b', amount: 100, currency: 'XAF', reference: 'r2',
    });
    assertEquals(r.status, 'executed');
    assertEquals(r.success, true);
    assertEquals(r.bank_tx_id, 'tx2');
  } finally { restore(); }
});

Deno.test('rest-bank: missing base_url throws on call', async () => {
  let threw = false;
  try { await restBankConnector.healthCheck({ ...makeCtx(), config: {} }); }
  catch (e) { threw = true; assert((e as Error).message.includes('base_url')); }
  assert(threw);
});
