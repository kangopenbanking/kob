// E2E smoke tests for bank-reconcile-engine — auth + admin gate, flag-only assertion.
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
const FN = `${SUPABASE_URL}/functions/v1/bank-reconcile-engine`;

Deno.test('bank-reconcile-engine: CORS preflight succeeds', async () => {
  const res = await fetch(FN, { method: 'OPTIONS' });
  await res.text();
  assertEquals(res.status, 200);
});

Deno.test('bank-reconcile-engine: rejects unauthenticated', async () => {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bank_id: '00000000-0000-0000-0000-000000000000' }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test('bank-reconcile-engine: anon (non-admin) is rejected (admin gate)', async () => {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ bank_id: '00000000-0000-0000-0000-000000000000' }),
  });
  await res.text();
  assert([401, 403].includes(res.status), `expected admin gate to deny anon, got ${res.status}`);
});
