// deno-lint-ignore-file
/**
 * Sandbox Router — exposes /v1/sandbox/* canonical REST surface.
 * Maps:
 *   POST /v1/sandbox/events/simulate     -> sandbox-trigger-webhook
 *   POST /v1/sandbox/payments/simulate   -> sandbox  (action=simulate_payment)
 *   POST /v1/sandbox/webhooks/send-test  -> sandbox-test-webhook
 *   POST /v1/sandbox/reset               -> sandbox  (action=reset)
 *
 * Internal implementation details (downstream function names) are NEVER
 * exposed to the caller; we always return the standard envelope and a
 * canonical request_id.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => {
  const request_id = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const body = typeof data === "object" && data !== null ? { ...(data as object), request_id } : { value: data, request_id };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-ID": request_id, ...extra },
  });
};

const error = (type: string, code: string, message: string, status: number) =>
  json({ error: { type, code, message, docs_url: `https://kangopenbanking.com/developer/errors/${code}` } }, status);

const ROUTES: Record<string, { fn: string; defaultBody?: Record<string, unknown> }> = {
  "POST /v1/sandbox/events/simulate":     { fn: "sandbox-trigger-webhook" },
  "POST /v1/sandbox/payments/simulate":   { fn: "sandbox", defaultBody: { action: "simulate_payment" } },
  "POST /v1/sandbox/webhooks/send-test":  { fn: "sandbox-test-webhook" },
  "POST /v1/sandbox/reset":               { fn: "sandbox", defaultBody: { action: "reset" } },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Normalise path: tolerate both /v1/sandbox/... and the function-relative /...
    let path = url.pathname.replace(/^\/functions\/v1\/sandbox-router/, "");
    if (!path.startsWith("/v1/")) path = `/v1/sandbox${path.startsWith("/") ? path : `/${path}`}`.replace("/v1/sandbox/v1/sandbox", "/v1/sandbox");

    const key = `${req.method} ${path}`;
    const route = ROUTES[key];
    if (!route) {
      return error("invalid_request_error", "route_not_found", `No sandbox route for ${key}`, 404);
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const merged = { ...(route.defaultBody ?? {}), ...body };

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const headers: Record<string, string> = {};
    const auth = req.headers.get("Authorization");
    if (auth) headers.Authorization = auth;
    const idem = req.headers.get("Idempotency-Key");
    if (idem) headers["Idempotency-Key"] = idem;

    const { data, error: fnError } = await supabase.functions.invoke(route.fn, { body: merged, headers });
    if (fnError) {
      const ctx = (fnError as any).context;
      if (ctx && typeof ctx.status === "number") {
        const downstream = await ctx.json().catch(() => ({ message: "downstream_error" }));
        return json(downstream, ctx.status);
      }
      return error("api_error", "downstream_failure", (fnError as Error).message ?? "downstream_failure", 502);
    }
    return json(data ?? { object: "sandbox_event", livemode: false });
  } catch (e: any) {
    const error_id = crypto.randomUUID().slice(0, 8);
    console.error(`[${error_id}] sandbox-router error:`, e);
    return error("api_error", "internal_error", `Internal error (id: ${error_id})`, 500);
  }
});
