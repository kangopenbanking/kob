/**
 * seed-e2e-users
 *
 * Idempotently provisions the four Playwright E2E test accounts:
 *   - e2e+admin@kob.test       (role: admin)
 *   - e2e+merchant@kob.test    (role: merchant + gateway_merchants row)
 *   - e2e+institution@kob.test (role: institution + institutions row)
 *   - e2e+consumer@kob.test    (role: personal)
 *
 * Auth: requires header `x-seed-token` matching the E2E_SEED_TOKEN secret.
 * Standing Order 4 (Surgeon Rule): additive only, no destructive ops.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

type SeedRole = 'admin' | 'merchant' | 'institution' | 'personal';

interface SeedSpec {
  email: string;
  role: SeedRole;
  fullName: string;
}

const SEED_USERS: SeedSpec[] = [
  { email: 'e2e+admin@kob.test',       role: 'admin',       fullName: 'E2E Admin' },
  { email: 'e2e+merchant@kob.test',    role: 'merchant',    fullName: 'E2E Merchant' },
  { email: 'e2e+institution@kob.test', role: 'institution', fullName: 'E2E Institution' },
  { email: 'e2e+consumer@kob.test',    role: 'personal',    fullName: 'E2E Consumer' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const seedToken = Deno.env.get('E2E_SEED_TOKEN');
  const password = Deno.env.get('E2E_PASSWORD');

  if (!url || !serviceKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }
  if (!seedToken || req.headers.get('x-seed-token') !== seedToken) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!password || password.length < 12) {
    return json({ error: 'E2E_PASSWORD secret missing or shorter than 12 chars' }, 400);
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const results: Array<Record<string, unknown>> = [];

  for (const spec of SEED_USERS) {
    try {
      const userId = await upsertAuthUser(sb, spec, password);
      await upsertProfile(sb, userId, spec);
      await upsertRole(sb, userId, spec.role);
      const extras = await upsertRoleExtras(sb, userId, spec);
      results.push({ email: spec.email, user_id: userId, role: spec.role, ...extras, ok: true });
    } catch (e) {
      results.push({ email: spec.email, ok: false, error: String((e as Error).message ?? e) });
    }
  }

  const ok = results.every((r) => r.ok);
  return json({ ok, password_set: true, users: results }, ok ? 200 : 207);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function upsertAuthUser(
  sb: ReturnType<typeof createClient>,
  spec: SeedSpec,
  password: string,
): Promise<string> {
  // Look up existing user by email via admin listUsers (paginated search).
  // listUsers has no email filter, so we page until we find it or exhaust.
  let page = 1;
  let existingId: string | null = null;
  while (page <= 20 && !existingId) {
    const { data, error } = await (sb as any).auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data?.users?.find((u: any) => u.email?.toLowerCase() === spec.email.toLowerCase());
    if (found) { existingId = found.id; break; }
    if (!data?.users?.length || data.users.length < 200) break;
    page++;
  }

  if (existingId) {
    const { error } = await (sb as any).auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName, e2e: true },
    });
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await (sb as any).auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName, e2e: true },
  });
  if (error) throw error;
  return data.user.id;
}

async function upsertProfile(sb: any, userId: string, spec: SeedSpec) {
  // profiles is auto-created by trigger in many setups; upsert by user_id is safe.
  await sb.from('profiles')
    .upsert({ user_id: userId, full_name: spec.fullName }, { onConflict: 'user_id' });
}

async function upsertRole(sb: any, userId: string, role: SeedRole) {
  // user_roles unique on (user_id, role)
  await sb.from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
}

async function upsertRoleExtras(sb: any, userId: string, spec: SeedSpec) {
  if (spec.role === 'institution') {
    const { data: existing } = await sb.from('institutions')
      .select('id').eq('user_id', userId).maybeSingle();
    if (existing?.id) return { institution_id: existing.id };
    const { data, error } = await sb.from('institutions').insert({
      user_id: userId,
      institution_name: 'E2E Test Institution',
      institution_type: 'commercial_bank',
      registration_number: 'E2E-INST-0001',
      country: 'CM',
      status: 'approved',
      sandbox_access: true,
    }).select('id').single();
    if (error) throw error;
    return { institution_id: data.id };
  }

  if (spec.role === 'merchant') {
    const { data: existing } = await sb.from('gateway_merchants')
      .select('id').eq('user_id', userId).maybeSingle();
    if (existing?.id) return { merchant_id: existing.id };
    const { data, error } = await sb.from('gateway_merchants').insert({
      user_id: userId,
      business_name: 'E2E Test Merchant',
      business_email: spec.email,
      status: 'active',
      kyb_status: 'approved',
      environment: 'test',
    }).select('id').single();
    if (error) throw error;
    return { merchant_id: data.id };
  }

  return {};
}
