// Health check for the Unified KYC Gateway.
// Reports Youverify reachability, circuit-breaker state, and self-hosted readiness.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Youverify reachability — lightweight ping with timeout
  const yvBase = Deno.env.get("YOUVERIFY_BASE_URL") ?? "https://api.sandbox.youverify.co";
  const yvKey = Deno.env.get("YOUVERIFY_API_KEY") ?? "";
  let yvUp = false, yvLatency = 0;
  if (yvKey) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const start = Date.now();
    try {
      const r = await fetch(`${yvBase}/`, { signal: ctrl.signal });
      yvLatency = Date.now() - start;
      yvUp = r.status < 500;
      await r.text();
    } catch { yvUp = false; }
    finally { clearTimeout(t); }
  }

  const { data: breaker } = await supabase.from("kyc_circuit_breaker_state").select("*").eq("provider", "youverify").maybeSingle();

  // Self-hosted readiness: confirm core tables exist by selecting count
  let shUp = true;
  const { error: shErr } = await supabase.from("kyc_verifications").select("id", { head: true, count: "exact" });
  if (shErr) shUp = false;

  // Recent metrics (last hour)
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent } = await supabase
    .from("kyc_verification_audit")
    .select("provider_used, fallback_triggered, youverify_success, youverify_response_time_ms")
    .gte("created_at", since);
  const rows = recent ?? [];
  const yvCalls = rows.filter(r => r.youverify_success !== null);
  const yvSuccess = yvCalls.filter(r => r.youverify_success).length;
  const yvSuccessRate = yvCalls.length ? Math.round((yvSuccess / yvCalls.length) * 1000) / 10 : null;
  const fallbackRate = rows.length ? Math.round((rows.filter(r => r.fallback_triggered).length / rows.length) * 1000) / 10 : null;
  const latencies = yvCalls.map(r => r.youverify_response_time_ms ?? 0).filter(n => n > 0).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;

  const overall = shUp && (yvUp || breaker?.state !== "open") ? "healthy" : "degraded";
  return json({
    status: overall,
    youverify: { up: yvUp, latency_ms: yvLatency, circuit_state: breaker?.state ?? "unknown", failure_count: breaker?.failure_count ?? 0 },
    self_hosted: { up: shUp },
    metrics_1h: { youverify_success_rate_pct: yvSuccessRate, fallback_rate_pct: fallbackRate, youverify_p95_latency_ms: p95, total_attempts: rows.length },
  });
});
