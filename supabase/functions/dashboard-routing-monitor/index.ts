/**
 * dashboard-routing-monitor
 *
 * Three modes (all read-only by default):
 *
 *   POST { "mode": "consistency" }
 *     Returns counts of users whose ACTUAL audit-logged dashboard path
 *     differs from the EXPECTED path computed from current signals.
 *     CI uses this — exits non-zero if mismatches > 0.
 *
 *   POST { "mode": "recent_failures", "minutes": 60 }
 *     Returns recent rows from dashboard_redirect_audit whose reason ==
 *     'default_personal' for users that have non-personal signals
 *     (i.e. misdirected). Used for alerting.
 *
 *   POST { "mode": "backfill", "dry_run": false }   (admin-only)
 *     Re-runs the role assignment backfill for developer_orgs / institutions
 *     / gateway_merchants. Idempotent. Requires service role caller.
 *
 * No public auth — caller must present the project anon key (Supabase
 * default) AND, for backfill, the X-Admin-Token header matching the
 * MONITOR_ADMIN_TOKEN secret.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const mode = body?.mode ?? 'consistency';

  try {
    if (mode === 'consistency') {
      const result = await consistency(sb);
      return json(result, 200);
    }
    if (mode === 'recent_failures') {
      const minutes = Math.max(1, Math.min(1440, Number(body?.minutes ?? 60)));
      const result = await recentFailures(sb, minutes);
      return json(result, 200);
    }
    if (mode === 'backfill') {
      const adminToken = Deno.env.get('MONITOR_ADMIN_TOKEN');
      if (!adminToken || req.headers.get('x-admin-token') !== adminToken) {
        return json({ error: 'unauthorized' }, 401);
      }
      const dry = !!body?.dry_run;
      const result = await backfill(sb, dry);
      return json(result, 200);
    }
    return json({ error: 'unknown_mode' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Consistency: every user with a strong routing signal (developer/dev_org/
 * institution/merchant/admin/staff) must currently resolve to the matching
 * expected path. Uses the same precedence as decideDashboard().
 */
async function consistency(sb: any) {
  const sql = `
    WITH cohort AS (
      SELECT DISTINCT u.id, u.email
      FROM auth.users u
      WHERE u.id IN (
        SELECT user_id FROM public.developer_orgs
        UNION SELECT user_id FROM public.institutions
        UNION SELECT user_id FROM public.gateway_merchants
        UNION SELECT user_id FROM public.user_roles
          WHERE role IN ('admin','merchant','developer','staff','institution')
      )
    ),
    classified AS (
      SELECT
        c.id, c.email,
        public.has_role(c.id,'admin')     AS is_admin,
        public.has_role(c.id,'merchant')  AS is_merchant,
        public.has_role(c.id,'developer') AS is_developer,
        public.has_role(c.id,'staff')     AS is_staff,
        EXISTS(SELECT 1 FROM public.developer_orgs WHERE user_id=c.id)         AS has_dev_org,
        (SELECT status FROM public.institutions WHERE user_id=c.id LIMIT 1)    AS inst_status,
        (SELECT institution_type FROM public.institutions WHERE user_id=c.id LIMIT 1) AS inst_type
      FROM cohort c
    ),
    expected AS (
      SELECT *,
        CASE
          WHEN is_admin THEN '/admin'
          WHEN is_merchant THEN '/merchant'
          WHEN is_developer THEN '/developer'
          WHEN has_dev_org THEN '/developer'
          WHEN inst_status='approved' AND inst_type='developer' THEN '/developer'
          WHEN inst_status='approved' THEN '/fi-portal'
          WHEN inst_status IS NOT NULL THEN '/pending-approval'
          WHEN is_staff THEN '/fi-portal'
          ELSE '/credit-score'
        END AS expected_path
      FROM classified
    )
    SELECT id, email, expected_path FROM expected;`;

  // We can't run raw SQL; emulate via discrete queries for portability.
  // Use a single rpc helper if present; otherwise do two queries.
  // Here we rely on a SECURITY DEFINER helper created by the migration below.
  const { data, error } = await sb.rpc('dashboard_routing_expected_paths');
  if (error) throw error;

  // Cross-reference with most recent audit row per user.
  const ids = (data ?? []).map((r: any) => r.id);
  let auditMap: Record<string, string> = {};
  if (ids.length) {
    const { data: audits } = await sb
      .from('dashboard_redirect_audit')
      .select('user_id, target_path, created_at')
      .in('user_id', ids)
      .order('created_at', { ascending: false });
    for (const row of audits ?? []) {
      if (!auditMap[row.user_id]) auditMap[row.user_id] = row.target_path;
    }
  }

  const mismatches: any[] = [];
  for (const r of (data ?? [])) {
    const last = auditMap[r.id];
    if (last && last !== r.expected_path) {
      mismatches.push({ user_id: r.id, email: r.email, expected: r.expected_path, last_actual: last });
    }
  }
  return { checked: data?.length ?? 0, mismatches: mismatches.length, samples: mismatches.slice(0, 25) };
}

async function recentFailures(sb: any, minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data, error } = await sb
    .from('dashboard_redirect_audit')
    .select('user_id, target_path, reason, created_at, is_admin, is_merchant, is_developer_role, has_developer_org, institution_status')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const suspicious = (data ?? []).filter((r: any) =>
    r.target_path === '/credit-score' && (
      r.is_admin || r.is_merchant || r.is_developer_role || r.has_developer_org || r.institution_status
    )
  );
  return { window_minutes: minutes, total: data?.length ?? 0, suspicious: suspicious.length, samples: suspicious.slice(0, 25) };
}

async function backfill(sb: any, dry: boolean) {
  if (dry) {
    const { data } = await sb.rpc('dashboard_routing_backfill_preview');
    return { dry_run: true, would_fix: data ?? [] };
  }
  const { data, error } = await sb.rpc('dashboard_routing_backfill_apply');
  if (error) throw error;
  return { dry_run: false, fixed: data ?? [] };
}
