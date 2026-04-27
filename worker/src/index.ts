/**
 * Kang Open Banking — API Gateway Worker
 * ----------------------------------------------------------------------------
 * Cloudflare Worker that fronts api.kangopenbanking.com and forwards every
 * request to the direct Supabase Edge Functions origin.
 *
 *   Public entry        →  https://api.kangopenbanking.com/v1/<resource>
 *   Forwarded origin    →  https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/<resource>
 *
 * Standing Orders honoured
 *   - SO 1 (The Lock) — no operationId, schema, or path renamed.
 *   - SO 4 (Surgeon)  — additive infrastructure only.
 *   - P3 (Free Sandbox) — sandbox routes pass through without auth gating.
 *   - P4 (Open Spec)  — /openapi.json + /openapi.yaml proxied unchanged.
 */

export interface Env {
  /** Direct Supabase Edge Functions origin. Set in wrangler.toml [vars]. */
  ORIGIN_BASE: string;
  /** Optional shared secret to mark traffic as coming through the gateway. */
  GATEWAY_SHARED_SECRET?: string;
  /** Build/deploy version surfaced by /health. */
  GATEWAY_VERSION?: string;
  /** Supabase service role key — used for API-key validation RPC. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** KV namespace caching validated API keys (5 min TTL). Optional. */
  API_KEY_CACHE?: KVNamespace;
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
    "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after, x-fapi-interaction-id, etag, last-modified, x-served-by, x-gateway-version",
  "access-control-max-age": "86400",
};

/**
 * Routes that bypass API-key auth.
 *   - Spec & docs (P4 Open Spec)
 *   - Health & status
 *   - OAuth / DCR token issuance (clients have no key yet at that stage)
 *   - Sandbox (P3 Free Sandbox)
 *   - The /health alias is served entirely at the edge.
 */
const PUBLIC_PREFIXES = [
  "/openapi",
  "/health",
  "/healthz",
  "/v1/oauth",
  "/v1/.well-known",
  "/v1/sandbox",
  "/v1/public-api-spec",
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS preflight — answered at the edge for zero origin round-trip.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 2. /health — served entirely at the edge with upstream latency probe.
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return handleHealth(env);
    }

    // 3. API-key gate for /v1/* (skips PUBLIC_PREFIXES).
    if (requiresApiKey(url.pathname)) {
      const auth = await authenticateApiKey(request, env, ctx);
      if (!auth.ok) {
        return problemJson(auth.status, auth.title, auth.detail, request);
      }
    }

    // 4. Path rewrite + forward.
    const originPath = rewritePath(url.pathname);
    const originUrl = new URL(originPath + url.search, env.ORIGIN_BASE);

    const forwardHeaders = new Headers();
    for (const [k, v] of request.headers) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) forwardHeaders.set(k, v);
    }
    forwardHeaders.set("x-forwarded-host", url.host);
    forwardHeaders.set("x-gateway", "kob-edge/1.0");
    if (env.GATEWAY_VERSION) forwardHeaders.set("x-gateway-version", env.GATEWAY_VERSION);
    if (env.GATEWAY_SHARED_SECRET) {
      forwardHeaders.set("x-gateway-secret", env.GATEWAY_SHARED_SECRET);
    }

    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
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

    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) responseHeaders.set(k, v);
    responseHeaders.set("x-served-by", "kob-edge-gateway");
    if (env.GATEWAY_VERSION) responseHeaders.set("x-gateway-version", env.GATEWAY_VERSION);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

/* -------------------------------------------------------------------------- */
/*  /health — version, status, upstream latency                                */
/* -------------------------------------------------------------------------- */

async function handleHealth(env: Env): Promise<Response> {
  const version = env.GATEWAY_VERSION ?? "1.0.0";
  const start = Date.now();
  let upstreamStatus = "unknown";
  let upstreamLatencyMs: number | null = null;
  let upstreamHttp: number | null = null;

  try {
    const probe = await fetch(`${env.ORIGIN_BASE}/functions/v1/health-check`, {
      method: "GET",
      cf: { cacheTtl: 0 } as any,
    });
    upstreamLatencyMs = Date.now() - start;
    upstreamHttp = probe.status;
    upstreamStatus = probe.ok ? "healthy" : "degraded";
  } catch (err) {
    upstreamLatencyMs = Date.now() - start;
    upstreamStatus = "unreachable";
  }

  const body = {
    service: "kob-edge-gateway",
    status: upstreamStatus === "healthy" ? "ok" : "degraded",
    version,
    timestamp: new Date().toISOString(),
    upstream: {
      origin: env.ORIGIN_BASE,
      status: upstreamStatus,
      http_status: upstreamHttp,
      latency_ms: upstreamLatencyMs,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: upstreamStatus === "healthy" ? 200 : 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-served-by": "kob-edge-gateway",
      "x-gateway-version": version,
      ...CORS_HEADERS,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  API-key authentication (hybrid: KV cache → Supabase RPC)                  */
/* -------------------------------------------------------------------------- */

function requiresApiKey(pathname: string): boolean {
  if (!pathname.startsWith("/v1/") && pathname !== "/v1") return false;
  return !PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

type AuthResult =
  | { ok: true; clientId: string }
  | { ok: false; status: number; title: string; detail: string };

async function authenticateApiKey(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<AuthResult> {
  // Accept either x-api-key OR Bearer token (OAuth flow handled downstream).
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization") ?? "";
  const hasBearer = /^Bearer\s+\S+/i.test(authHeader);

  // OAuth bearer tokens are validated by the downstream edge function.
  if (hasBearer && !apiKey) return { ok: true, clientId: "oauth-bearer" };

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      title: "Missing API key",
      detail:
        "Requests to /v1 must include an 'x-api-key' header or a valid Bearer token. Request keys at https://kangopenbanking.com/developer/registration.",
    };
  }

  // 1. Hash the presented key (SHA-256) — matches api_clients.client_secret_hash.
  const hash = await sha256Hex(apiKey);

  // 2. Fast path: KV cache (5-minute TTL).
  if (env.API_KEY_CACHE) {
    const cached = await env.API_KEY_CACHE.get(`key:${hash}`);
    if (cached === "revoked") {
      return { ok: false, status: 403, title: "Revoked API key", detail: "This API key has been revoked." };
    }
    if (cached) return { ok: true, clientId: cached };
  }

  // 3. Slow path: validate against Supabase via PostgREST.
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // Fail open with audit trail — gateway misconfigured. Do NOT block traffic.
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set; API-key validation skipped.");
    return { ok: true, clientId: "unverified" };
  }

  try {
    const lookup = await fetch(
      `${env.ORIGIN_BASE}/rest/v1/api_clients?select=client_id,is_active,expires_at&client_secret_hash=eq.${hash}&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          accept: "application/json",
        },
      },
    );

    if (!lookup.ok) {
      console.error("api_clients lookup failed", lookup.status);
      return { ok: true, clientId: "unverified" }; // fail open
    }

    const rows = (await lookup.json()) as Array<{
      client_id: string;
      is_active: boolean;
      expires_at: string | null;
    }>;
    const row = rows[0];

    if (!row) {
      return { ok: false, status: 401, title: "Invalid API key", detail: "API key not recognised." };
    }
    if (!row.is_active) {
      if (env.API_KEY_CACHE) {
        ctx.waitUntil(env.API_KEY_CACHE.put(`key:${hash}`, "revoked", { expirationTtl: 300 }));
      }
      return { ok: false, status: 403, title: "Revoked API key", detail: "This API key has been revoked." };
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, status: 403, title: "Expired API key", detail: "This API key has expired." };
    }

    if (env.API_KEY_CACHE) {
      ctx.waitUntil(env.API_KEY_CACHE.put(`key:${hash}`, row.client_id, { expirationTtl: 300 }));
    }
    return { ok: true, clientId: row.client_id };
  } catch (err) {
    console.error("API key validation error", err);
    return { ok: true, clientId: "unverified" }; // fail open on infrastructure error
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* -------------------------------------------------------------------------- */
/*  Path rewriting & error envelope                                           */
/* -------------------------------------------------------------------------- */

function rewritePath(pathname: string): string {
  if (pathname === "/openapi.json") return "/functions/v1/public-api-spec";
  if (pathname === "/openapi.yaml") return "/functions/v1/public-api-spec.yaml";
  if (pathname.startsWith("/functions/v1/")) return pathname;
  if (pathname.startsWith("/v1/")) return "/functions/v1" + pathname.substring(3);
  if (pathname === "/v1") return "/functions/v1";
  if (pathname === "/" || pathname === "") return "/functions/v1/public-api-spec";
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
        "www-authenticate": status === 401 ? 'ApiKey realm="kangopenbanking"' : "",
        ...CORS_HEADERS,
      },
    },
  );
}
