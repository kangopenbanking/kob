// supabase/functions/admin-gateway-audit
// Returns gateway_audit_logs for the last N days (admin only).
// Query: ?days=7|30  &client_id=...  &status=429  &limit=500

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return j(401, { error: 'Unauthorized' });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return j(401, { error: 'Unauthorized' });

  const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roleRows ?? []).some((r: any) => r.role === 'admin');
  if (!isAdmin) return j(403, { error: 'Forbidden' });

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '7', 10), 1), 30);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10), 2000);
  const clientId = url.searchParams.get('client_id');
  const status = url.searchParams.get('status');
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  let q = supabase
    .from('gateway_audit_logs')
    .select('id, request_id, client_id, key_version, method, path, status, latency_ms, ip, country, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (clientId) q = q.eq('client_id', clientId);
  if (status) q = q.eq('status', parseInt(status, 10));

  const { data, error } = await q;
  if (error) return j(500, { error: error.message });

  // Aggregates
  const total = data?.length ?? 0;
  const byStatus: Record<string, number> = {};
  const byClient: Record<string, number> = {};
  let latencySum = 0;
  for (const r of data ?? []) {
    byStatus[String(r.status)] = (byStatus[String(r.status)] ?? 0) + 1;
    if (r.client_id) byClient[r.client_id] = (byClient[r.client_id] ?? 0) + 1;
    latencySum += r.latency_ms ?? 0;
  }

  return j(200, {
    days,
    total,
    avg_latency_ms: total ? Math.round(latencySum / total) : 0,
    by_status: byStatus,
    by_client: byClient,
    rows: data ?? [],
  });
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
