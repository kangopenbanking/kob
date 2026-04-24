/**
 * Kang Open Banking — API Gateway Worker
 * ----------------------------------------------------------------------------
 * Cloudflare Worker that fronts api.kangopenbanking.com and forwards every
 * request to the direct Supabase Edge Functions origin.
 *
 *   Public entry        →  https://api.kangopenbanking.com/v1/<resource>
 *   Forwarded origin    →  https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/<resource>
 *
 * Why this exists
 *   - Gives developers a branded, version-stable API hostname.
 *   - Keeps the runtime (apps + SDKs) untouched: the Direct Backend Mandate in
 *     src/config/api.ts is preserved. Only outward-facing documentation calls
 *     this proxy.
 *   - Reversible: when a Supabase Custom Domain is provisioned, repoint the
 *     CNAME and decommission this worker.
 *
 * Standing Orders honoured
 *   - SO 1 (The Lock) — no operationId, schema, or path renamed.
 *   - SO 4 (Surgeon)  — additive infrastructure only.
 *   - P3 (Free Sandbox) — sandbox routes pass through without auth gating.
 *   - P4 (Open Spec)  — /openapi.json + /openapi.yaml proxied unchanged.
 *
 * Deployment
 *   $ cd worker && npm install && npx wrangler deploy
 *   See worker/README.md for the full procedure.
 */

export interface Env {
  /** Direct Supabase Edge Functions origin. Set in wrangler.toml [vars]. */
  ORIGIN_BASE: string;
  /** Optional shared secret to mark traffic as coming through the gateway. */
  GATEWAY_SHARED_SECRET?: string;
}

/** Headers we strip from the inbound request before forwarding. */
const HOP_BY_HOP = new Set([
  "host",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-real-ip",
]);

/** CORS — match the existing Supabase function policy (open for public docs). */
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-fapi-interaction-id, x-merchant-id, x-api-key",
  "access-control-expose-headers":
    "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after, x-fapi-interaction-id, etag, last-modified",
  "access-control-max-age": "86400",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. CORS preflight — answered at the edge for zero origin round-trip.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 2. Path rewrite.
    //    Public surface: /v1/<rest>            → origin: /functions/v1/<rest>
    //    Spec aliases:   /openapi.{json,yaml}  → origin: /functions/v1/public-api-spec(.yaml)
    //    Health:         /health               → origin: /functions/v1/health-check
    //    Anything else is forwarded verbatim under /functions/v1/.
    const originPath = rewritePath(url.pathname);
    const originUrl = new URL(originPath + url.search, env.ORIGIN_BASE);

    // 3. Build the forwarded request.
    const forwardHeaders = new Headers();
    for (const [k, v] of request.headers) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) forwardHeaders.set(k, v);
    }
    forwardHeaders.set("x-forwarded-host", url.host);
    forwardHeaders.set("x-gateway", "kob-edge/1.0");
    if (env.GATEWAY_SHARED_SECRET) {
      forwardHeaders.set("x-gateway-secret", env.GATEWAY_SHARED_SECRET);
    }

    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      // GET/HEAD must not have a body; everything else streams through.
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    };

    let upstream: Response;
    try {
      upstream = await fetch(originUrl.toString(), init);
    } catch (err) {
      const message = err instanceof Error ? err.message : "upstream fetch failed";
      return problemJson(502, "Bad Gateway", message, request);
    }

    // 4. Copy upstream response, layer CORS, expose Supabase debug headers.
    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) responseHeaders.set(k, v);
    responseHeaders.set("x-served-by", "kob-edge-gateway");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

function rewritePath(pathname: string): string {
  // Spec aliases — keep the public, friendly URLs working through the gateway.
  if (pathname === "/openapi.json") return "/functions/v1/public-api-spec";
  if (pathname === "/openapi.yaml") return "/functions/v1/public-api-spec.yaml";
  if (pathname === "/health" || pathname === "/healthz") return "/functions/v1/health-check";

  // Already-prefixed origin path (lets internal tools call /functions/v1/* directly).
  if (pathname.startsWith("/functions/v1/")) return pathname;

  // Versioned API surface — strip the leading /v1 and forward under /functions/v1/.
  if (pathname.startsWith("/v1/")) {
    return "/functions/v1" + pathname.substring(3);
  }
  if (pathname === "/v1") return "/functions/v1";

  // Root → spec discovery for crawlers.
  if (pathname === "/" || pathname === "") return "/functions/v1/public-api-spec";

  // Fallback — forward as-is under /functions/v1/.
  return "/functions/v1" + pathname;
}

function problemJson(status: number, title: string, detail: string, req: Request): Response {
  return new Response(
    JSON.stringify({
      type: "https://kangopenbanking.com/errors/gateway",
      title,
      status,
      detail,
      instance: new URL(req.url).pathname,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        ...CORS_HEADERS,
      },
    },
  );
}
