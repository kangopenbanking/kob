// Admin endpoint smoke test — requires ADMIN_USER_JWT.
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')!;
const ADMIN_JWT = Deno.env.get('PTP_ADMIN_JWT');
const skip = !ADMIN_JWT;
const fn = `${SUPABASE_URL}/functions/v1/ptp-admin-ops`;

Deno.test({
  name: 'admin list returns promises array',
  ignore: skip,
  fn: async () => {
    const r = await fetch(`${fn}?action=list&limit=10`, {
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
    });
    const j = await r.json();
    assert(Array.isArray(j.promises), 'expected promises array');
  },
});

Deno.test({
  name: 'non-admin without JWT rejected with 403',
  fn: async () => {
    const r = await fetch(`${fn}?action=list`, { headers: { Authorization: 'Bearer invalid' } });
    await r.text();
    assertEquals(r.status, 403);
  },
});
