/**
 * Payment Orchestrator (Phase 4 — v4.37.0) — FEATURE-FLAGGED, OFF BY DEFAULT.
 *
 * Sits in front of the existing payment-router-charge edge function. When the
 * flag is OFF (default), it transparently delegates the call to the legacy
 * router so production behaviour is unchanged.
 *
 * Flag source: `system_config.payment_orchestrator_enabled = true`.
 *
 * Standing Order 4 (Surgeon): no existing function/path modified.
 * Standing Order 6 (Version Gate): exposed via OpenAPI 4.37.0 only.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createLogger, getOrCreateTraceId } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function isOrchestratorEnabled(): Promise<boolean> {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data } = await admin
      .from("system_config")
      .select("value")
      .eq("key", "payment_orchestrator_enabled")
      .maybeSingle();
    return data?.value === true || data?.value === "true";
  } catch {
    return false; // fail closed → behave as legacy
  }
}

async function delegateToLegacy(req: Request, traceId: string): Promise<Response> {
  const url = `${SUPABASE_URL}/functions/v1/payment-router-charge`;
  const headers = new Headers(req.headers);
  headers.set("X-Trace-Id", traceId);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  return fetch(url, { method: req.method, headers, body });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const traceId = getOrCreateTraceId(req);
  const log = createLogger({ trace_id: traceId, function: "payment-orchestrator" });

  try {
    const enabled = await isOrchestratorEnabled();
    log.info("orchestrator_dispatch", { enabled });

    // Flag OFF → transparent passthrough (zero behaviour change).
    if (!enabled) {
      const upstream = await delegateToLegacy(req, traceId);
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
          "X-Trace-Id": traceId,
          "X-Orchestrator": "passthrough",
        },
      });
    }

    // Flag ON → orchestrated path (still delegates to legacy charge processor today;
    // future iterations will add DLQ writes, multi-provider fallback, etc.)
    const upstream = await delegateToLegacy(req, traceId);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "X-Trace-Id": traceId,
        "X-Orchestrator": "active",
      },
    });
  } catch (err) {
    log.error("orchestrator_error", { error: String(err) });
    return new Response(
      JSON.stringify({
        type: "https://kangopenbanking.com/errors/internal",
        title: "Orchestrator failure",
        status: 500,
        trace_id: traceId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/problem+json", "X-Trace-Id": traceId } }
    );
  }
});
