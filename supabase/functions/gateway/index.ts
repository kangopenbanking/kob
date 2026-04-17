/**
 * Gateway REST-to-Action Translator
 *
 * Maps documented nested REST paths (e.g. `GET /gateway/charges/:id`)
 * to the actual deployed action-based downstream functions.
 *
 * Public contract (OpenAPI) uses RESTful nested paths.
 * Internal functions are flat and action-based.
 * This wrapper is the bridge.
 *
 * Acceptable downstream outcomes for a documented route:
 *   200 / 400 / 401 / 403 / app-level 404 (resource not found)
 * Unacceptable:
 *   "Requested function was not found" (means routing is broken)
 */
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

type Mapping = {
  fn: string;                              // downstream function
  action?: string;                         // ?action= or body.action
  idParam?: string;                        // name of path-id param when injected
  passIdAs?: string;                       // query/body key for the id (default "id")
};

/**
 * Routing table.
 * Key = `METHOD /family[/segments]` with `:id` for path params.
 * Order matters: longer/more-specific paths declared first.
 */
const ROUTES: Array<{ pattern: RegExp; method: string; map: Mapping }> = [
  // ─── CHARGES ───
  { method: "POST", pattern: /^charges\/([^/]+)\/verify$/,   map: { fn: "gateway-charges-router", action: "verify", passIdAs: "id" } },
  { method: "POST", pattern: /^charges\/([^/]+)\/validate$/, map: { fn: "gateway-charges-router", action: "validate", passIdAs: "id" } },
  { method: "POST", pattern: /^charges\/([^/]+)\/preauth$/,  map: { fn: "gateway-charges-router", action: "preauth", passIdAs: "id" } },
  { method: "GET",  pattern: /^charges\/([^/]+)$/,           map: { fn: "gateway-query", action: "get-charge", passIdAs: "id" } },
  { method: "GET",  pattern: /^charges$/,                    map: { fn: "gateway-query", action: "list-charges" } },
  { method: "POST", pattern: /^charges$/,                    map: { fn: "gateway-charges-router", action: "create" } },

  // ─── REFUNDS ───
  { method: "GET",  pattern: /^refunds\/([^/]+)$/, map: { fn: "gateway-query", action: "get-refund", passIdAs: "id" } },
  { method: "GET",  pattern: /^refunds$/,          map: { fn: "gateway-query", action: "list-refunds" } },
  { method: "POST", pattern: /^refunds$/,          map: { fn: "gateway-create-refund" } },

  // ─── PAYOUTS ───
  // NOTE: bypass gateway-payouts-router (uses functions.invoke which masks
  // downstream non-2xx as 500) — call leaf functions directly so 401/400
  // propagate correctly to API consumers.
  { method: "POST", pattern: /^payouts\/([^/]+)\/cancel$/, map: { fn: "gateway-cancel-payout", passIdAs: "payout_id" } },
  { method: "POST", pattern: /^payouts\/([^/]+)\/retry$/,  map: { fn: "gateway-retry-payout", passIdAs: "payout_id" } },
  { method: "GET",  pattern: /^payouts\/([^/]+)$/,         map: { fn: "gateway-query", action: "get-payout", passIdAs: "id" } },
  { method: "GET",  pattern: /^payouts$/,                  map: { fn: "gateway-query", action: "list-payouts" } },
  { method: "POST", pattern: /^payouts$/,                  map: { fn: "gateway-create-payout" } },

  // ─── DISPUTES ───
  { method: "POST", pattern: /^disputes\/([^/]+)\/evidence$/, map: { fn: "gateway-submit-dispute-evidence", passIdAs: "dispute_id" } },
  { method: "GET",  pattern: /^disputes\/([^/]+)$/,           map: { fn: "gateway-query", action: "get-dispute", passIdAs: "id" } },
  { method: "GET",  pattern: /^disputes$/,                    map: { fn: "gateway-query", action: "list-disputes" } },
  { method: "POST", pattern: /^disputes$/,                    map: { fn: "gateway-file-dispute" } },

  // ─── SETTLEMENTS ───
  { method: "GET",  pattern: /^settlements\/([^/]+)$/, map: { fn: "gateway-query", action: "get-settlement", passIdAs: "id" } },
  { method: "GET",  pattern: /^settlements$/,          map: { fn: "gateway-query", action: "list-settlements" } },

  // ─── MERCHANTS — bypass gateway-merchant-router; call leaves directly ───
  { method: "GET",  pattern: /^merchants\/([^/]+)\/balance$/,  map: { fn: "gateway-get-merchant-balance", passIdAs: "merchant_id" } },
  { method: "GET",  pattern: /^merchants\/([^/]+)\/statement$/,map: { fn: "gateway-merchant-statement", passIdAs: "merchant_id" } },
  { method: "POST", pattern: /^merchants\/([^/]+)\/keys$/,     map: { fn: "gateway-merchant-keys", passIdAs: "merchant_id" } },
  { method: "POST", pattern: /^merchants\/([^/]+)\/kyb$/,      map: { fn: "gateway-merchant-kyb", passIdAs: "merchant_id" } },

  // ─── PAYMENT LINKS ───
  { method: "GET",  pattern: /^payment-links\/([^/]+)$/, map: { fn: "gateway-query", action: "get-payment-link", passIdAs: "id" } },
  { method: "GET",  pattern: /^payment-links$/,          map: { fn: "gateway-query", action: "list-payment-links" } },
  { method: "POST", pattern: /^payment-links$/,          map: { fn: "gateway-create-payment-link" } },

  // ─── SUBSCRIPTIONS ───
  { method: "POST", pattern: /^subscriptions\/([^/]+)\/cancel$/, map: { fn: "gateway-cancel-subscription", passIdAs: "subscription_id" } },
  { method: "GET",  pattern: /^subscriptions\/([^/]+)$/,         map: { fn: "gateway-query", action: "get-subscription", passIdAs: "id" } },
  { method: "GET",  pattern: /^subscriptions$/,                  map: { fn: "gateway-query", action: "list-subscriptions" } },
  { method: "POST", pattern: /^subscriptions$/,                  map: { fn: "gateway-create-subscription" } },

  // ─── WEBHOOKS — call leaf directly ───
  { method: "GET",  pattern: /^webhooks$/,  map: { fn: "gateway-webhook-endpoints" } },
  { method: "POST", pattern: /^webhooks$/,  map: { fn: "gateway-webhook-endpoints" } },

  // ─── FUNDING — call leaves directly ───
  { method: "POST", pattern: /^funding\/intents$/,   map: { fn: "gateway-create-funding-intent" } },
  { method: "POST", pattern: /^funding\/confirm$/,   map: { fn: "gateway-confirm-funding" } },
  { method: "GET",  pattern: /^funding\/intents\/([^/]+)$/, map: { fn: "gateway-query", action: "get-funding-intent", passIdAs: "id" } },
  { method: "GET",  pattern: /^funding\/intents$/,   map: { fn: "gateway-query", action: "list-funding-intents" } },

  // ─── ESCROW ───
  { method: "GET",  pattern: /^escrow\/wallets$/,    map: { fn: "gateway-escrow-wallets" } },
  { method: "POST", pattern: /^escrow\/wallets$/,    map: { fn: "gateway-escrow-wallets" } },

  // ─── FEE ESTIMATE ───
  { method: "GET",  pattern: /^fee-estimate$/,       map: { fn: "gateway-fee-estimate" } },
  { method: "POST", pattern: /^fee-estimate$/,       map: { fn: "gateway-fee-estimate" } },

  // ─── BULK ───
  { method: "POST", pattern: /^bulk$/,               map: { fn: "gateway-bulk-operations" } },

  // ─── RECONCILIATION ───
  { method: "POST", pattern: /^reconciliation$/,     map: { fn: "gateway-reconciliation" } },
];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const subpath = url.pathname.replace(/^\/gateway\/?/, "").replace(/\/$/, "");

  // Discovery root
  if (!subpath) {
    return json({
      service: "Kang Open Banking — Payment Gateway",
      version: "4.9.7",
      contract: "REST",
      documentation: "https://kangopenbanking.com/developer",
      families: [
        "charges", "refunds", "payouts", "disputes", "settlements",
        "merchants", "payment-links", "subscriptions", "webhooks",
        "funding", "escrow", "fee-estimate", "bulk", "reconciliation",
      ],
    });
  }

  // Find matching route
  let matched: { map: Mapping; pathId?: string } | null = null;
  for (const route of ROUTES) {
    if (route.method !== req.method) continue;
    const m = subpath.match(route.pattern);
    if (m) {
      matched = { map: route.map, pathId: m[1] };
      break;
    }
  }

  if (!matched) {
    return json(
      {
        error: "route_not_found",
        message: `No route for ${req.method} /gateway/${subpath}`,
        hint: "See discovery at GET /gateway",
      },
      404,
    );
  }

  const { map, pathId } = matched;

  // Build query string preserving caller params and adding action/id
  const forwardParams = new URLSearchParams(url.search);
  if (map.action) forwardParams.set("action", map.action);
  if (pathId && map.passIdAs) forwardParams.set(map.passIdAs, pathId);

  const targetUrl = `${SUPABASE_URL}/functions/v1/${map.fn}?${forwardParams.toString()}`;

  // Forward headers — preserve auth as-is. Do NOT inject service role.
  const fwdHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const kl = k.toLowerCase();
    if (["host", "content-length", "connection"].includes(kl)) continue;
    fwdHeaders.set(k, v);
  }

  // For POST/PUT/PATCH, read body once so we can inject action/id into JSON
  let bodyToSend: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      let parsed: any = {};
      try {
        const text = await req.text();
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      if (map.action && !parsed.action) parsed.action = map.action;
      if (pathId && map.passIdAs && parsed[map.passIdAs] === undefined) {
        parsed[map.passIdAs] = pathId;
      }
      bodyToSend = JSON.stringify(parsed);
      fwdHeaders.set("content-type", "application/json");
    } else {
      // pass through raw body for non-JSON (e.g. webhooks)
      bodyToSend = await req.arrayBuffer();
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: fwdHeaders,
      body: bodyToSend,
    });
    const buf = await upstream.arrayBuffer();
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders)) respHeaders.set(k, v);
    return new Response(buf, { status: upstream.status, headers: respHeaders });
  } catch (err) {
    return json({ error: "upstream_error", message: String(err) }, 502);
  }
});
