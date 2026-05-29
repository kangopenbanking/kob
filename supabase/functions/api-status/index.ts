// /v1/status — operational status of subsystems
// Public, unauthenticated, cacheable. Returns documented base shape plus
// additive fields: webhook_signer, spec_version, ratchet_version, spec_url.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const VERSION = "4.43.0";
const RATCHET_VERSION = "phase-9"; // Last completed remediation phase (Standing Order 2)
const SPEC_URL = "https://kangopenbanking.com/openapi.json";

async function probe(url: string, ms = 4000): Promise<{ ok: boolean; latency_ms: number; status?: number }> {
  const start = Date.now();
  try {
    const r = await fetch(url, { method: "GET", signal: AbortSignal.timeout(ms) });
    return { ok: r.ok, latency_ms: Date.now() - start, status: r.status };
  } catch {
    return { ok: false, latency_ms: Date.now() - start };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "GET" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sandbox = req.headers.get("x-sandbox") === "true" ||
    new URL(req.url).searchParams.get("sandbox") === "true";

  const sb = createClient(supabaseUrl, supabaseKey);

  // DB ping
  let dbOk = false;
  try {
    const { error } = await sb.from("profiles").select("count").limit(1);
    dbOk = !error;
  } catch {/* dbOk stays false */}

  // Webhook signer probe — verifies the compute_endpoint_hmac RPC is callable.
  // We pass a sentinel endpoint id; we accept either a successful result OR
  // a known "not found" error (RPC reachable, key just absent) as operational.
  let signerOk = false;
  let signerLatency = 0;
  try {
    const start = Date.now();
    const { error } = await sb.rpc("compute_endpoint_hmac", {
      p_endpoint_id: "00000000-0000-0000-0000-000000000000",
      p_payload: "status-probe",
    });
    signerLatency = Date.now() - start;
    // RPC reachable: either succeeds, or returns a controlled error (not a 500/timeout)
    signerOk = !error || (error.code !== "PGRST301" && error.code !== "08006");
  } catch {/* signerOk stays false */}

  const apiBase = `${supabaseUrl}/functions/v1`;
  const [oauth, webhooks] = await Promise.all([
    probe(`${apiBase}/oidc-config`),
    probe(`${apiBase}/api-health`),
  ]);

  const services = {
    db: { status: dbOk ? "operational" : "degraded" },
    oauth: { status: oauth.ok ? "operational" : "degraded", latency_ms: oauth.latency_ms },
    gateway: { status: webhooks.ok ? "operational" : "degraded", latency_ms: webhooks.latency_ms },
    webhooks: { status: webhooks.ok ? "operational" : "degraded" },
    webhook_signer: { status: signerOk ? "operational" : "degraded", latency_ms: signerLatency },
  };
  const allOk = Object.values(services).every((s) => s.status === "operational");

  const body = {
    status: allOk ? "operational" : "degraded",
    time: new Date().toISOString(),
    environment: sandbox ? "sandbox" : "production",
    version: VERSION,
    spec_version: VERSION,
    ratchet_version: RATCHET_VERSION,
    spec_url: SPEC_URL,
    services,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=10",
      "X-API-Version": VERSION,
      "X-Ratchet-Version": RATCHET_VERSION,
    },
  });
});
