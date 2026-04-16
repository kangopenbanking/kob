/**
 * Gateway compatibility router.
 * Maps nested paths like /gateway/charges to the correct flat function.
 *
 * Supabase Edge Functions use flat naming (gateway-charges-router),
 * but external integrators and OpenAPI docs reference nested paths
 * (/gateway/charges). This thin proxy bridges the two.
 */
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Map first path segment to actual deployed function name */
const ROUTE_MAP: Record<string, string> = {
  "charges":        "gateway-charges-router",
  "refunds":        "gateway-create-refund",
  "merchants":      "gateway-merchant-router",
  "payouts":        "gateway-payouts-router",
  "disputes":       "gateway-disputes-router",
  "webhooks":       "gateway-webhooks-router",
  "subscriptions":  "gateway-create-subscription",
  "payment-links":  "gateway-create-payment-link",
  "settlements":    "gateway-settlement-router",
  "funding":        "gateway-funding-router",
  "withdrawals":    "gateway-withdrawal-router",
  "escrow":         "gateway-escrow-wallets",
  "fee-estimate":   "gateway-fee-estimate",
  "bulk":           "gateway-bulk-operations",
  "query":          "gateway-query",
  "reconciliation": "gateway-reconciliation",
  "validate":       "gateway-validate-charge",
  "verify":         "gateway-verify-charge",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Extract subpath: /gateway/charges/abc → ["charges", "abc"]
  const parts = url.pathname.replace(/^\/gateway\/?/, "").split("/").filter(Boolean);
  const routeKey = parts[0]?.toLowerCase() ?? "";

  if (!routeKey) {
    return new Response(
      JSON.stringify({
        service: "Kang Open Banking — Payment Gateway",
        version: "4.0.0",
        documentation: "https://kangopenbanking.com/developer",
        routes: Object.keys(ROUTE_MAP),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const targetFn = ROUTE_MAP[routeKey];
  if (!targetFn) {
    return new Response(
      JSON.stringify({ error: "not_found", message: `Unknown gateway route: /${routeKey}` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Build target URL preserving remaining path segments and query string
  const remainingPath = parts.slice(1).join("/");
  const targetUrl = `${SUPABASE_URL}/functions/v1/${targetFn}${remainingPath ? `/${remainingPath}` : ""}${url.search}`;

  // Forward the request, preserving method, headers, and body
  const headers = new Headers(req.headers);
  // Ensure the service role key is set so the downstream function can authenticate
  if (!headers.get("authorization")) {
    headers.set("authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    ...(req.body && req.method !== "GET" && req.method !== "HEAD" ? { body: req.body, duplex: "half" as any } : {}),
  };

  try {
    const upstream = await fetch(targetUrl, init);
    const body = await upstream.arrayBuffer();
    const respHeaders = new Headers(upstream.headers);
    // Ensure CORS on the proxied response
    Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
    return new Response(body, { status: upstream.status, headers: respHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "upstream_error", message: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
