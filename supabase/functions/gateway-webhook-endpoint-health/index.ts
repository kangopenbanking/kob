// PERMANENT PUBLIC API — DO NOT REMOVE OR REDIRECT
// Phase 2 — Webhook reliability: per-endpoint health snapshot (last 24h)
// Justification: Stripe/PayPal parity for endpoint observability.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return problem(405, 'Method Not Allowed', `${req.method} is not supported`);
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authResult = await resolveAuth(req, supabase);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;

    const url = new URL(req.url);
    let endpointId = url.searchParams.get('endpoint_id') || undefined;
    if (!endpointId && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      endpointId = body.endpoint_id;
    }
    if (!endpointId) return problem(400, 'Bad Request', 'endpoint_id is required');

    // Load endpoint
    const { data: ep, error: eErr } = await supabase
      .from('gateway_webhook_endpoints')
      .select('id, merchant_id, url, is_active, created_at')
      .eq('id', endpointId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!ep) return problem(404, 'Not Found', 'Endpoint not found');

    // Ownership check
    const { data: adminRole } = await supabase
      .from('user_roles').select('role').eq('user_id', auth.user_id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      const { data: merch } = await supabase
        .from('gateway_merchants').select('id').eq('id', ep.merchant_id).eq('user_id', auth.user_id).maybeSingle();
      if (!merch) return problem(403, 'Forbidden', 'Not authorized for this endpoint');
    }

    // Window: last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: rows } = await supabase
      .from('gateway_webhook_deliveries_v2')
      .select('status, response_status, created_at, delivered_at')
      .eq('endpoint_id', ep.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000);

    const deliveries = rows || [];
    const total = deliveries.length;
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;
    const pending = deliveries.filter(d => d.status === 'pending').length;
    const exhausted = deliveries.filter(d => d.status === 'exhausted').length;

    const successRate = total === 0 ? null : Number(((delivered / total) * 100).toFixed(2));

    // Latency from created_at → delivered_at (ms) for delivered rows
    const latencies = deliveries
      .filter(d => d.delivered_at)
      .map(d => new Date(d.delivered_at as string).getTime() - new Date(d.created_at).getTime())
      .filter(n => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);

    const pct = (arr: number[], p: number) =>
      arr.length === 0 ? null : arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

    const lastDelivery = deliveries.find(d => d.status === 'delivered');
    const lastFailure = deliveries.find(d => d.status === 'failed' || d.status === 'exhausted');

    // Health score: weighted success_rate, attenuated when no traffic
    let health: 'healthy' | 'degraded' | 'unhealthy' | 'idle';
    if (total === 0) health = 'idle';
    else if (successRate! >= 95) health = 'healthy';
    else if (successRate! >= 75) health = 'degraded';
    else health = 'unhealthy';

    return json({
      endpoint_id: ep.id,
      url: ep.url,
      is_active: ep.is_active,
      window: '24h',
      health,
      totals: { total, delivered, failed, pending, exhausted },
      success_rate_pct: successRate,
      latency_ms: {
        p50: pct(latencies, 50),
        p95: pct(latencies, 95),
        p99: pct(latencies, 99),
      },
      last_delivery_at: lastDelivery?.delivered_at ?? null,
      last_failure_at: lastFailure?.created_at ?? null,
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-webhook-endpoint-health error:`, err);
    return problem(500, 'Internal Server Error', err?.message ?? 'unknown');
  }
});
