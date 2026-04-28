// /v1/status — operational status of subsystems
// Public, unauthenticated, cacheable. Mirrors documented response shape:
//   { status, time, environment, version, services: { db, oauth, gateway, webhooks } }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const VERSION = "4.18.0";

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

  // DB ping
  let dbOk = false;
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { error } = await sb.from("profiles").select("count").limit(1);
    dbOk = !error;
  } catch {/* dbOk stays false */}

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
  };
  const allOk = Object.values(services).every((s) => s.status === "operational");

  const body = {
    status: allOk ? "operational" : "degraded",
    time: new Date().toISOString(),
    environment: sandbox ? "sandbox" : "production",
    version: VERSION,
    services,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=10",
    },
  });
});
