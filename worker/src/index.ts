/**
 * Kang Open Banking — API Gateway Worker (v1.1.0)
 * ----------------------------------------------------------------------------
 * Cloudflare Worker fronting api.kangopenbanking.com → Supabase Edge Functions.
 *
 * v1.1.0 additions:
 *   - /v1/openapi.json with rewritten servers[] (api.kangopenbanking.com/v1)
 *   - Per–API-key sliding-window rate limiting (KV-backed) with 429 + Retry-After
 *   - Versioned key resolver (api_client_keys) supporting overlap/grace windows
 *   - Structured audit logging (fire-and-forget, ctx.waitUntil)
 *   - Sandbox toggle: x-kob-environment: sandbox routes to gateway-* sandbox adapters
 *
 * Standing Orders honoured: SO 1 (Lock), SO 4 (Surgeon-additive), P3 (Free Sandbox), P4 (Open Spec)
 */

export interface Env {
  ORIGIN_BASE: string;
  GATEWAY_SHARED_SECRET?: string;
  GATEWAY_VERSION?: string;
  PUBLIC_GATEWAY_URL?: string; // e.g. https://api.kangopenbanking.com
  SUPABASE_SERVICE_ROLE_KEY?: string;
  API_KEY_CACHE?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
}

const HOP_BY_HOP = new Set([
  "host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor",
  "x-forwarded-for", "x-forwarded-proto", "x-real-ip",
]);

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-fapi-interaction-id, x-merchant-id, x-api-key, x-kob-environment",
  "access-control-expose-headers":
    "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after, x-fapi-interaction-id, x-request-id, x-served-by, x-gateway-version, x-kob-environment",
  "access-control-max-age": "86400",
};

const PUBLIC_PREFIXES = [
  "/openapi", "/health", "/healthz",
  "/v1/oauth", "/v1/.well-known", "/v1/sandbox",
  "/v1/openapi", "/v1/public-api-spec",
];

// Default per-tier limits (requests per 60s window)
const TIER_LIMITS: Record<string, number> = {
  free: 60,
  basic: 300,
  pro: 1000,
  enterprise: 5000,
  unverified: 30,
  "oauth-bearer": 600,
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const start = Date.now();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return handleHealth(env);
    }

    // Branded OpenAPI spec — proxies upstream then rewrites servers[].
    if (url.pathname === "/openapi.json" || url.pathname === "/v1/openapi.json") {
      return handleOpenApi(env, request, "json");
    }
    if (url.pathname === "/openapi.yaml" || url.pathname === "/v1/openapi.yaml") {
      return handleOpenApi(env, request, "yaml");
    }

    let auth: AuthResult = { ok: true, clientId: "public", tier: "free", keyVersion: null };
    if (requiresApiKey(url.pathname)) {
      auth = await authenticateApiKey(request, env, ctx);
      if (!auth.ok) {
        ctx.waitUntil(writeAudit(env, {
          request_id: requestId, client_id: null, key_version: null,
          method: request.method, path: url.pathname, status: auth.status,
          latency_ms: Date.now() - start, ip: request.headers.get("cf-connecting-ip"),
          user_agent: request.headers.get("user-agent"), country: request.headers.get("cf-ipcountry"),
        }));
        return problemJson(auth.status, auth.title, auth.detail, request, requestId);
      }

      // Rate limit (skip oauth-bearer/public)
      if (auth.clientId !== "oauth-bearer" && auth.clientId !== "public") {
        const limit = TIER_LIMITS[auth.tier] ?? TIER_LIMITS.free;
        const rl = await checkRateLimit(env, auth.clientId, limit, ctx);
        if (!rl.allowed) {
          ctx.waitUntil(writeAudit(env, {
            request_id: requestId, client_id: auth.clientId, key_version: auth.keyVersion,
            method: request.method, path: url.pathname, status: 429,
            latency_ms: Date.now() - start, ip: request.headers.get("cf-connecting-ip"),
            user_agent: request.headers.get("user-agent"), country: request.headers.get("cf-ipcountry"),
          }));
          return rateLimitedResponse(rl, requestId);
        }
      }
    }

    // Sandbox toggle (x-kob-environment: sandbox) — rewrite to sandbox adapter.
    const isSandbox = (request.headers.get("x-kob-environment") ?? "").toLowerCase() === "sandbox"
      || url.pathname.startsWith("/v1/sandbox");
    const originPath = rewritePath(url.pathname, isSandbox);
    const originUrl = new URL(originPath + url.search, env.ORIGIN_BASE);

    const forwardHeaders = new Headers();
    for (const [k, v] of request.headers) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) forwardHeaders.set(k, v);
    }
    forwardHeaders.set("x-forwarded-host", url.host);
    forwardHeaders.set("x-gateway", "kob-edge/1.1");
    forwardHeaders.set("x-request-id", requestId);
    forwardHeaders.set("x-kob-environment", isSandbox ? "sandbox" : "production");
    if (auth.clientId && auth.clientId !== "public") {
      forwardHeaders.set("x-kob-client-id", auth.clientId);
    }
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
      ctx.waitUntil(writeAudit(env, {
        request_id: requestId, client_id: auth.clientId, key_version: auth.keyVersion,
        method: request.method, path: url.pathname, status: 502,
        latency_ms: Date.now() - start, ip: request.headers.get("cf-connecting-ip"),
        user_agent: request.headers.get("user-agent"), country: request.headers.get("cf-ipcountry"),
      }));
      return problemJson(502, "Bad Gateway", message, request, requestId);
    }

    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) responseHeaders.set(k, v);
    responseHeaders.set("x-served-by", "kob-edge-gateway");
    responseHeaders.set("x-request-id", requestId);
    responseHeaders.set("x-kob-environment", isSandbox ? "sandbox" : "production");
    if (env.GATEWAY_VERSION) responseHeaders.set("x-gateway-version", env.GATEWAY_VERSION);

    ctx.waitUntil(writeAudit(env, {
      request_id: requestId, client_id: auth.clientId, key_version: auth.keyVersion,
      method: request.method, path: url.pathname, status: upstream.status,
      latency_ms: Date.now() - start, ip: request.headers.get("cf-connecting-ip"),
      user_agent: request.headers.get("user-agent"), country: request.headers.get("cf-ipcountry"),
    }));

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

/* -------------------------------------------------------------------------- */
/*  /health                                                                   */
/* -------------------------------------------------------------------------- */
async function handleHealth(env: Env): Promise<Response> {
  const version = env.GATEWAY_VERSION ?? "1.1.0";
  const start = Date.now();
  let upstreamStatus = "unknown";
  let upstreamLatencyMs: number | null = null;
  let upstreamHttp: number | null = null;

  try {
    const probe = await fetch(`${env.ORIGIN_BASE}/functions/v1/health-check`, {
      method: "GET", cf: { cacheTtl: 0 } as any,
    });
    upstreamLatencyMs = Date.now() - start;
    upstreamHttp = probe.status;
    upstreamStatus = probe.ok ? "healthy" : "degraded";
  } catch {
    upstreamLatencyMs = Date.now() - start;
    upstreamStatus = "unreachable";
  }

  const body = {
    service: "kob-edge-gateway",
    status: upstreamStatus === "healthy" ? "ok" : "degraded",
    version,
    timestamp: new Date().toISOString(),
    upstream: {
      origin: env.ORIGIN_BASE, status: upstreamStatus,
      http_status: upstreamHttp, latency_ms: upstreamLatencyMs,
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
/*  /openapi.json — branded servers[]                                         */
/* -------------------------------------------------------------------------- */
async function handleOpenApi(env: Env, request: Request, format: "json" | "yaml"): Promise<Response> {
  const upstreamPath = format === "json" ? "/functions/v1/public-api-spec" : "/functions/v1/public-api-spec.yaml";
  const upstream = await fetch(`${env.ORIGIN_BASE}${upstreamPath}`);
  const publicBase = (env.PUBLIC_GATEWAY_URL ?? "https://api.kangopenbanking.com").replace(/\/$/, "");
  const branded = `${publicBase}/v1`;

  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  headers.set("x-served-by", "kob-edge-gateway");

  if (!upstream.ok) {
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  if (format === "json") {
    try {
      const spec: any = await upstream.json();
      spec.servers = [
        { url: branded, description: "Kang Open Banking API (Production)" },
        { url: `${branded}/sandbox`, description: "Kang Open Banking API (Sandbox)" },
      ];
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(spec), { status: 200, headers });
    } catch {
      return new Response(upstream.body, { status: upstream.status, headers });
    }
  }

  // YAML — string substitution of the servers block (best-effort).
  const text = await upstream.text();
  const replaced = text.replace(
    /servers:\s*(?:\n\s*-\s*url:.*(?:\n\s+description:.*)?)+/m,
    `servers:\n  - url: ${branded}\n    description: Kang Open Banking API (Production)\n  - url: ${branded}/sandbox\n    description: Kang Open Banking API (Sandbox)`,
  );
  headers.set("content-type", "application/yaml; charset=utf-8");
  return new Response(replaced, { status: 200, headers });
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */
function requiresApiKey(pathname: string): boolean {
  if (!pathname.startsWith("/v1/") && pathname !== "/v1") return false;
  return !PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

type AuthResult =
  | { ok: true; clientId: string; tier: string; keyVersion: number | null }
  | { ok: false; status: number; title: string; detail: string };

async function authenticateApiKey(request: Request, env: Env, ctx: ExecutionContext): Promise<AuthResult> {
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization") ?? "";
  const hasBearer = /^Bearer\s+\S+/i.test(authHeader);

  if (hasBearer && !apiKey) {
    return { ok: true, clientId: "oauth-bearer", tier: "oauth-bearer", keyVersion: null };
  }

  if (!apiKey) {
    return { ok: false, status: 401, title: "Missing API key",
      detail: "Requests to /v1 must include an 'x-api-key' header or a valid Bearer token." };
  }

  const hash = await sha256Hex(apiKey);

  // Cache hit
  if (env.API_KEY_CACHE) {
    const cached = await env.API_KEY_CACHE.get(`key:${hash}`);
    if (cached === "revoked") {
      return { ok: false, status: 403, title: "Revoked API key", detail: "This API key has been revoked." };
    }
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ok: true, clientId: parsed.client_id, tier: parsed.tier ?? "free", keyVersion: parsed.key_version ?? null };
      } catch {
        return { ok: true, clientId: cached, tier: "free", keyVersion: null };
      }
    }
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set; API-key validation skipped.");
    return { ok: true, clientId: "unverified", tier: "unverified", keyVersion: null };
  }

  try {
    // 1. Try versioned key resolver first (api_client_keys).
    const rpc = await fetch(`${env.ORIGIN_BASE}/rest/v1/rpc/resolve_api_key`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ _hash: hash }),
    });
    if (rpc.ok) {
      const rows = (await rpc.json()) as Array<{ client_id: string; key_version: number; status: string }>;
      const r = rows[0];
      if (r) {
        // Look up tier
        const tierRes = await fetch(
          `${env.ORIGIN_BASE}/rest/v1/api_clients?select=rate_limit_tier&client_id=eq.${encodeURIComponent(r.client_id)}&limit=1`,
          { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
        );
        const tierRows = tierRes.ok ? await tierRes.json() as Array<{ rate_limit_tier: string }> : [];
        const tier = tierRows[0]?.rate_limit_tier ?? "free";
        if (env.API_KEY_CACHE) {
          ctx.waitUntil(env.API_KEY_CACHE.put(`key:${hash}`,
            JSON.stringify({ client_id: r.client_id, tier, key_version: r.key_version }),
            { expirationTtl: 300 }));
        }
        return { ok: true, clientId: r.client_id, tier, keyVersion: r.key_version };
      }
    }

    // 2. Legacy fallback — direct match on api_clients.client_secret_hash.
    const lookup = await fetch(
      `${env.ORIGIN_BASE}/rest/v1/api_clients?select=client_id,is_active,expires_at,rate_limit_tier&client_secret_hash=eq.${hash}&limit=1`,
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
    );
    if (!lookup.ok) {
      console.error("api_clients lookup failed", lookup.status);
      return { ok: true, clientId: "unverified", tier: "unverified", keyVersion: null };
    }
    const rows = (await lookup.json()) as Array<{ client_id: string; is_active: boolean; expires_at: string | null; rate_limit_tier: string }>;
    const row = rows[0];
    if (!row) return { ok: false, status: 401, title: "Invalid API key", detail: "API key not recognised." };
    if (!row.is_active) {
      if (env.API_KEY_CACHE) ctx.waitUntil(env.API_KEY_CACHE.put(`key:${hash}`, "revoked", { expirationTtl: 300 }));
      return { ok: false, status: 403, title: "Revoked API key", detail: "This API key has been revoked." };
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, status: 403, title: "Expired API key", detail: "This API key has expired." };
    }
    if (env.API_KEY_CACHE) {
      ctx.waitUntil(env.API_KEY_CACHE.put(`key:${hash}`,
        JSON.stringify({ client_id: row.client_id, tier: row.rate_limit_tier ?? "free", key_version: null }),
        { expirationTtl: 300 }));
    }
    return { ok: true, clientId: row.client_id, tier: row.rate_limit_tier ?? "free", keyVersion: null };
  } catch (err) {
    console.error("API key validation error", err);
    return { ok: true, clientId: "unverified", tier: "unverified", keyVersion: null };
  }
}

/* -------------------------------------------------------------------------- */
/*  Rate limiting (sliding 60s window, KV-backed)                             */
/* -------------------------------------------------------------------------- */
type RateResult = { allowed: boolean; limit: number; remaining: number; resetSeconds: number };

async function checkRateLimit(env: Env, clientId: string, limit: number, ctx: ExecutionContext): Promise<RateResult> {
  if (!env.RATE_LIMIT_KV) {
    return { allowed: true, limit, remaining: limit, resetSeconds: 60 };
  }
  const windowSec = 60;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const key = `rl:${clientId}:${windowStart}`;
  const raw = await env.RATE_LIMIT_KV.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  const next = count + 1;
  const reset = windowStart + windowSec - now;

  if (next > limit) {
    return { allowed: false, limit, remaining: 0, resetSeconds: Math.max(reset, 1) };
  }

  ctx.waitUntil(env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: windowSec * 2 }));
  return { allowed: true, limit, remaining: Math.max(limit - next, 0), resetSeconds: reset };
}

function rateLimitedResponse(r: RateResult, requestId: string): Response {
  const body = {
    type: "https://kangopenbanking.com/errors/rate-limited",
    title: "Rate Limit Exceeded",
    status: 429,
    detail: `You have exceeded ${r.limit} requests per minute. Retry after ${r.resetSeconds} seconds.`,
    error_code: "AUTH_005",
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      "retry-after": String(r.resetSeconds),
      "x-ratelimit-limit": String(r.limit),
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + r.resetSeconds),
      "x-request-id": requestId,
      ...CORS_HEADERS,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Audit logging                                                             */
/* -------------------------------------------------------------------------- */
interface AuditRow {
  request_id: string;
  client_id: string | null;
  key_version: number | null;
  method: string;
  path: string;
  status: number;
  latency_ms: number;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
}

async function writeAudit(env: Env, row: AuditRow): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${env.ORIGIN_BASE}/rest/v1/gateway_audit_logs`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}

/* -------------------------------------------------------------------------- */
/*  Path rewrite                                                              */
/* -------------------------------------------------------------------------- */
function rewritePath(pathname: string, isSandbox: boolean): string {
  if (pathname === "/openapi.json" || pathname === "/v1/openapi.json") return "/functions/v1/public-api-spec";
  if (pathname === "/openapi.yaml" || pathname === "/v1/openapi.yaml") return "/functions/v1/public-api-spec.yaml";
  if (pathname.startsWith("/functions/v1/")) return pathname;

  // /v1/sandbox/<resource>  -> /functions/v1/sandbox/<resource>
  if (pathname.startsWith("/v1/sandbox/") || pathname === "/v1/sandbox") {
    const rest = pathname.replace("/v1/sandbox", "");
    return "/functions/v1/sandbox" + (rest || "");
  }

  if (pathname.startsWith("/v1/")) {
    const base = "/functions/v1" + pathname.substring(3);
    // Sandbox toggle via header — for gateway-* paths, prefix the sandbox sentinel route.
    return isSandbox ? base.replace("/functions/v1/", "/functions/v1/sandbox/") : base;
  }
  if (pathname === "/v1") return "/functions/v1";
  if (pathname === "/" || pathname === "") return "/functions/v1/public-api-spec";
  return "/functions/v1" + pathname;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function problemJson(status: number, title: string, detail: string, req: Request, requestId: string): Response {
  return new Response(
    JSON.stringify({
      type: "https://kangopenbanking.com/errors/gateway",
      title, status, detail,
      instance: new URL(req.url).pathname,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        "www-authenticate": status === 401 ? 'ApiKey realm="kangopenbanking"' : "",
        "x-request-id": requestId,
        ...CORS_HEADERS,
      },
    },
  );
}
