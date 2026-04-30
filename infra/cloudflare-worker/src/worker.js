/**
 * Kang Open Banking — Cloudflare Worker for inbound provider webhooks.
 *
 * PUBLIC EDGE: api.kangopenbanking.com
 * INTERNAL ORIGIN: held in env.UPSTREAM_BASE — never exposed in any response,
 *                  log line, error body, or response header. Cloudflare strips
 *                  Server / Via / X-Powered-By on the way out.
 *
 * Routes (POST only, JSON bodies, signature header preserved byte-for-byte):
 *   /webhooks/v1/stripe       -> {UPSTREAM_BASE}/gateway-webhook-stripe
 *   /webhooks/v1/flutterwave  -> {UPSTREAM_BASE}/gateway-webhook-flutterwave
 *   /webhooks/v1/paypal       -> {UPSTREAM_BASE}/gateway-webhook-paypal
 *
 * Health (GET):
 *   /webhooks/v1/health       -> { ok: true, edge: "cloudflare" }
 *
 * All other paths return 404. The Worker never echoes or logs the upstream
 * URL; outbound errors are returned as RFC-7807 problem documents using only
 * the public host name.
 */

const ROUTES = {
  stripe: {
    path: "/webhooks/v1/stripe",
    upstream: "/gateway-webhook-stripe",
    sigHeader: "stripe-signature",
    extraHeaders: [],
  },
  flutterwave: {
    path: "/webhooks/v1/flutterwave",
    upstream: "/gateway-webhook-flutterwave",
    sigHeader: "verif-hash",
    extraHeaders: [],
  },
  paypal: {
    path: "/webhooks/v1/paypal",
    upstream: "/gateway-webhook-paypal",
    sigHeader: "paypal-transmission-sig",
    extraHeaders: [
      "paypal-transmission-id",
      "paypal-transmission-time",
      "paypal-cert-url",
      "paypal-auth-algo",
    ],
  },
};

// Headers Cloudflare must NEVER pass through to the response.
const STRIP_RESPONSE_HEADERS = [
  "server",
  "via",
  "x-powered-by",
  "x-supabase-region",
  "x-deno-region",
  "x-served-by",
  "cf-ray",
];

function problem(status, code, detail, host) {
  return new Response(JSON.stringify({
    type: `https://${host}/errors/${code}`,
    title: code,
    status,
    code,
    detail,
  }), {
    status,
    headers: {
      "Content-Type": "application/problem+json",
      "X-Webhook-Error-Code": code,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;

    // Health probe
    if (url.pathname === "/webhooks/v1/health") {
      if (request.method !== "GET") {
        return problem(405, "method_not_allowed", "Use GET for health probe.", host);
      }
      return new Response(JSON.stringify({ ok: true, edge: "cloudflare", host }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Match a known route
    const route = Object.values(ROUTES).find((r) => r.path === url.pathname);
    if (!route) {
      return problem(404, "not_found", "Unknown webhook receiver path.", host);
    }

    if (request.method !== "POST") {
      return problem(405, "method_not_allowed", "Webhook receivers only accept POST.", host);
    }

    // Required upstream config — held only in Worker env, never returned.
    if (!env.UPSTREAM_BASE) {
      return problem(503, "edge_misconfigured", "Receiver edge is not configured.", host);
    }

    // Build forwarded headers — preserve ONLY the signature material.
    const fwd = new Headers();
    fwd.set("Content-Type", request.headers.get("content-type") ?? "application/json");

    const sig = request.headers.get(route.sigHeader);
    if (sig) fwd.set(route.sigHeader, sig);
    for (const h of route.extraHeaders) {
      const v = request.headers.get(h);
      if (v) fwd.set(h, v);
    }

    // Provide the platform anon key as the upstream invocation token.
    // The receiver still validates the provider signature on the body.
    if (env.UPSTREAM_INVOKE_KEY) {
      fwd.set("Authorization", `Bearer ${env.UPSTREAM_INVOKE_KEY}`);
    }

    // Edge correlation id — surfaced to client + logged.
    const correlation = crypto.randomUUID();
    fwd.set("X-Edge-Correlation-Id", correlation);

    const body = await request.arrayBuffer();
    const upstreamUrl = `${env.UPSTREAM_BASE.replace(/\/+$/, "")}${route.upstream}`;

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: fwd,
        body,
      });
    } catch (err) {
      // Never include upstreamUrl or err.message — both could leak the origin.
      console.warn(JSON.stringify({
        kind: "edge_upstream_error",
        correlation,
        path: url.pathname,
      }));
      return problem(502, "upstream_unreachable", "Upstream verifier is unreachable.", host);
    }

    // Sanitize response headers — strip anything that could leak the origin.
    const outHeaders = new Headers();
    for (const [k, v] of upstream.headers) {
      if (STRIP_RESPONSE_HEADERS.includes(k.toLowerCase())) continue;
      outHeaders.set(k, v);
    }
    outHeaders.set("X-Edge", "cloudflare");
    outHeaders.set("X-Edge-Correlation-Id", correlation);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  },
};
