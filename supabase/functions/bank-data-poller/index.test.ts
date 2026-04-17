// E2E smoke tests for bank-data-poller — auth gate + CORS.
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!;
const FN = `${SUPABASE_URL}/functions/v1/bank-data-poller`;

Deno.test('bank-data-poller: CORS preflight succeeds', async () => {
  const res = await fetch(FN, { method: 'OPTIONS' });
  await res.text();
  assertEquals(res.status, 200);
});

Deno.test('bank-data-poller: rejects unauthenticated POST', async () => {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  await res.text();
  assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
});
