// KYC Gateway metrics endpoint.
// Returns provider latency (p50/p95), fallback rate, circuit breaker state,
// and Youverify error breakdowns per country over a requested window.
//
// Admin-only. JWT verified in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth + admin gate
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const url = new URL(req.url);
  const windowMin = Math.min(Math.max(parseInt(url.searchParams.get("window_min") ?? "60", 10) || 60, 5), 1440 * 7);
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();

  const { data: rows, error } = await supabase
    .from("kyc_verification_audit")
    .select("provider_used, fallback_triggered, fallback_reason, youverify_success, youverify_response_time_ms, self_hosted_response_time_ms, verification_result, error_code, country, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);

  if (error) return json({ error: "audit_query_failed", message: error.message }, 500);

  const audits = rows ?? [];
  const total = audits.length;
  const yvAttempts = audits.filter((r) => r.youverify_success !== null).length;
  const yvSuccess = audits.filter((r) => r.youverify_success === true).length;
  const yvFail = audits.filter((r) => r.youverify_success === false).length;
  const fallbacks = audits.filter((r) => r.fallback_triggered).length;

  const yvLatencies = audits.map((r) => r.youverify_response_time_ms).filter((v): v is number => typeof v === "number");
  const shLatencies = audits.map((r) => r.self_hosted_response_time_ms).filter((v): v is number => typeof v === "number");

  // Per-country error breakdown
  const byCountry: Record<string, Record<string, number>> = {};
  for (const r of audits) {
    if (!r.error_code) continue;
    const c = (r.country ?? "UNKNOWN").toUpperCase();
    byCountry[c] ??= {};
    byCountry[c][r.error_code] = (byCountry[c][r.error_code] ?? 0) + 1;
  }

  // Fallback reasons
  const byFallbackReason: Record<string, number> = {};
  for (const r of audits) {
    if (!r.fallback_triggered) continue;
    const k = r.fallback_reason ?? "unknown";
    byFallbackReason[k] = (byFallbackReason[k] ?? 0) + 1;
  }

  const { data: breaker } = await supabase
    .from("kyc_circuit_breaker_state")
    .select("*")
    .eq("provider", "youverify")
    .maybeSingle();

  return json({
    window_minutes: windowMin,
    generated_at: new Date().toISOString(),
    totals: {
      total_requests: total,
      youverify_attempts: yvAttempts,
      youverify_success: yvSuccess,
      youverify_failures: yvFail,
      fallbacks_to_self_hosted: fallbacks,
      fallback_rate: total ? Math.round((fallbacks / total) * 10000) / 100 : 0,
      youverify_success_rate: yvAttempts ? Math.round((yvSuccess / yvAttempts) * 10000) / 100 : null,
    },
    latency_ms: {
      youverify: { p50: percentile(yvLatencies, 50), p95: percentile(yvLatencies, 95), samples: yvLatencies.length },
      self_hosted: { p50: percentile(shLatencies, 50), p95: percentile(shLatencies, 95), samples: shLatencies.length },
    },
    circuit_breaker: breaker ?? { state: "closed" },
    fallback_reasons: byFallbackReason,
    youverify_errors_by_country: byCountry,
  });
});
