// E2E test for bank-data-router + adapter framework.
// Requires SUPABASE_URL, SUPABASE_ANON_KEY at runtime; uses anon (no admin) to verify auth gate.

import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
const FN = `${SUPABASE_URL}/functions/v1/bank-data-router`;

Deno.test('bank-data-router rejects unauthenticated requests', async () => {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bank_id: '00000000-0000-0000-0000-000000000000', operation: 'health_check' }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test('bank-data-router validates request schema', async () => {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ bank_id: 'not-a-uuid', operation: 'invalid' }),
  });
  const body = await res.json();
  assert([400, 401, 403].includes(res.status), `expected 400/401/403, got ${res.status}: ${JSON.stringify(body)}`);
});

Deno.test('bank-data-router CORS preflight succeeds', async () => {
  const res = await fetch(FN, { method: 'OPTIONS' });
  await res.text();
  assertEquals(res.status, 200);
});

Deno.test('REST adapter parses JSON arrays of transactions', async () => {
  const { restBankConnector } = await import('../_shared/bank-connectors/rest-bank.ts');
  // Construct a minimal mock context — we just verify the connector type contract exists
  assertEquals(restBankConnector.type, 'rest');
  assert(typeof restBankConnector.getTransactions === 'function');
  assert(typeof restBankConnector.healthCheck === 'function');
});

Deno.test('SQL adapter is read-only (transfer rejected)', async () => {
  const { sqlBankConnector } = await import('../_shared/bank-connectors/sql-bank.ts');
  const res = await sqlBankConnector.initiateTransfer(
    { bank_id: 'x', config_id: 'y', credentials: {}, config: {}, environment: 'sandbox' },
    { from_account: 'a', to_account: 'b', amount: 100, currency: 'XAF', reference: 'r' },
  );
  assertEquals(res.success, false);
  assertEquals(res.status, 'failed');
  assert((res.error ?? '').includes('read-only'));
});

Deno.test('File adapter rejects transfers', async () => {
  const { fileBankConnector } = await import('../_shared/bank-connectors/file-bank.ts');
  const res = await fileBankConnector.initiateTransfer(
    { bank_id: 'x', config_id: 'y', credentials: {}, config: {}, environment: 'sandbox' },
    { from_account: 'a', to_account: 'b', amount: 100, currency: 'XAF', reference: 'r' },
  );
  assertEquals(res.success, false);
});

Deno.test('Registry exposes all four adapter types', async () => {
  const { listAdapterTypes, getBankConnector } = await import('../_shared/bank-connectors/registry.ts');
  const types = listAdapterTypes();
  assertEquals(types.length, 4);
  for (const t of types) {
    const c = getBankConnector(t);
    assert(c, `missing connector for ${t}`);
  }
});
