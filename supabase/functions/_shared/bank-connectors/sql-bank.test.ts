// Unit tests for SQL bank adapter — read-only enforcement, gateway POST shape, watermark.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sqlBankConnector } from './sql-bank.ts';
import type { BankConnectorContext } from './types.ts';

function makeCtx(overrides: Partial<BankConnectorContext> = {}): BankConnectorContext {
  return {
    bank_id: 'bank-1',
    config_id: 'cfg-1',
    credentials: { gateway_token: 'gw-token' },
    config: { gateway_url: 'https://sql.bank.test/query' },
    environment: 'sandbox',
    ...overrides,
  };
}

function stubFetch(handler: (req: Request, body: unknown) => Response | Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    let body: unknown = null;
    try { body = JSON.parse(init?.body as string ?? '{}'); } catch { /* ignore */ }
    return await handler(req, body);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

Deno.test('sql-bank: contract surface', () => {
  assertEquals(sqlBankConnector.type, 'sql');
  assertEquals(sqlBankConnector.requiredConfigFields(), ['gateway_url']);
  assertEquals(sqlBankConnector.requiredCredentialFields(), ['gateway_token']);
});

Deno.test('sql-bank: initiateTransfer is rejected (read-only policy)', async () => {
  const r = await sqlBankConnector.initiateTransfer(makeCtx(), {
    from_account: 'a', to_account: 'b', amount: 100, currency: 'XAF', reference: 'r',
  });
  assertEquals(r.success, false);
  assertEquals(r.status, 'failed');
  assert((r.error ?? '').toLowerCase().includes('read-only'));
});

Deno.test('sql-bank: gateway POST shape — operation + named params', async () => {
  let captured: Record<string, unknown> | null = null;
  const restore = stubFetch((req, body) => {
    captured = body as Record<string, unknown>;
    assertEquals(req.headers.get('Authorization'), 'Bearer gw-token');
    return new Response(JSON.stringify({ external_account_id: 'A1', currency: 'XAF' }), { status: 200 });
  });
  try {
    await sqlBankConnector.getAccountDetails(makeCtx(), 'A1');
    assertEquals((captured as { operation: string }).operation, 'account');
    assertEquals(((captured as { params: Record<string, unknown> }).params).account_id, 'A1');
  } finally { restore(); }
});

Deno.test('sql-bank: getTransactions passes watermark + date range params', async () => {
  let captured: Record<string, unknown> | null = null;
  const restore = stubFetch((_req, body) => {
    captured = body as Record<string, unknown>;
    return new Response(JSON.stringify([]), { status: 200 });
  });
  try {
    await sqlBankConnector.getTransactions(
      { ...makeCtx(), watermark: '2026-01-15T00:00:00Z' },
      'ACC-1',
      { from: '2026-01-01', to: '2026-01-31' },
    );
    const params = (captured as { params: Record<string, unknown> }).params;
    assertEquals(params.account_id, 'ACC-1');
    assertEquals(params.from_date, '2026-01-01');
    assertEquals(params.to_date, '2026-01-31');
    assertEquals(params.watermark, '2026-01-15T00:00:00Z');
  } finally { restore(); }
});

Deno.test('sql-bank: gateway error maps to thrown Error', async () => {
  const restore = stubFetch(() => new Response('boom', { status: 502 }));
  try {
    let threw = false;
    try { await sqlBankConnector.getBalance(makeCtx(), 'X'); }
    catch (e) { threw = true; assert((e as Error).message.includes('502')); }
    assert(threw);
  } finally { restore(); }
});

Deno.test('sql-bank: healthCheck reports unhealthy on failure', async () => {
  const restore = stubFetch(() => new Response('down', { status: 500 }));
  try {
    const h = await sqlBankConnector.healthCheck(makeCtx());
    assertEquals(h.healthy, false);
    assert(typeof h.latency_ms === 'number');
  } finally { restore(); }
});

Deno.test('sql-bank: missing gateway_url throws', async () => {
  let threw = false;
  try { await sqlBankConnector.getBalance({ ...makeCtx(), config: {} }, 'x'); }
  catch (e) { threw = true; assert((e as Error).message.includes('gateway_url')); }
  assert(threw);
});
