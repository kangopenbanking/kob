// PERMANENT PUBLIC ENDPOINT — DO NOT REMOVE OR REDIRECT (Order P3)
// Executes a real HTTPS request against the public sandbox API for the
// "Try it" buttons on /developer/examples/real-world. The frontend never
// holds an API key — this function injects the sandbox bearer server-side
// (KOB_SANDBOX_API_KEY if provisioned, otherwise the public demo key
// printed in /developer/getting-started). All responses are returned
// verbatim with the real upstream status, headers (whitelisted) and body.
import { corsHeaders } from "../_shared/cors.ts";

const SANDBOX_BASE = "https://sandbox-api.kangopenbanking.com";
const PUBLIC_DEMO_KEY = "sk_test_kob_sandbox_demo_key_2024";

// Allowlist: every entry mirrors public/openapi.json + the cards on
// /developer/examples/real-world. The frontend must send a slug from
// realWorldExamplesData.ts; unknown slugs are rejected.
const ALLOW: Record<string, { method: string; pathRegex: RegExp; idempotent?: boolean; fapi?: boolean }> = {
  "01-merchant-onboarding-kyb-api-keys":              { method: "POST", pathRegex: /^\/v1\/merchants$/, idempotent: true },
  "02-accept-payments-create-charge":                 { method: "POST", pathRegex: /^\/v1\/gateway\/charges$/, idempotent: true, fapi: true },
  "03-add-money-account-funding":                     { method: "POST", pathRegex: /^\/v1\/gateway\/funding-intents$/, idempotent: true },
  "04-refunds":                                       { method: "POST", pathRegex: /^\/v1\/gateway\/refunds$/, idempotent: true, fapi: true },
  "05-payouts-single-bulk-paypal":                    { method: "POST", pathRegex: /^\/v1\/gateway\/payouts$/, idempotent: true, fapi: true },
  "06-webhooks-merchant-outbound-deliveries-rotation":{ method: "POST", pathRegex: /^\/v1\/webhooks\/v2\/endpoints$/, idempotent: true },
  "07-settlements-reporting-exports-reconciliation":  { method: "GET",  pathRegex: /^\/v1\/gateway\/settlements(\?.*)?$/ },
  "08-disputes-chargebacks-evidence":                 { method: "POST", pathRegex: /^\/v1\/gateway\/disputes\/[A-Za-z0-9_-]+\/evidence$/, idempotent: true },
  "09-open-banking-aisp-consent-accounts-transactions":{ method: "POST", pathRegex: /^\/v1\/aisp\/consents$/, idempotent: true },
  "10-open-banking-pisp-consent-domestic-payment":    { method: "POST", pathRegex: /^\/v1\/pisp\/payment-submission$/, idempotent: true, fapi: true },
  "11-build-marketplace-checkout":                    { method: "POST", pathRegex: /^\/v1\/gateway\/charges$/, idempotent: true, fapi: true },
  "12-build-bank-data-aggregator":                    { method: "GET",  pathRegex: /^\/v1\/aisp\/accounts\/[A-Za-z0-9_-]+\/transactions(\?.*)?$/, fapi: true },
};

// Tiny in-memory rate limiter (best-effort; cold starts reset state).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const buckets = new Map<string, { n: number; resetAt: number }>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) { buckets.set(ip, { n: 1, resetAt: now + RATE_WINDOW_MS }); return true; }
  if (b.n >= RATE_MAX) return false;
  b.n++; return true;
}

const HEADER_WHITELIST = new Set([
  "content-type", "x-request-id", "x-ratelimit-remaining", "x-ratelimit-limit",
  "x-ratelimit-reset", "x-fapi-interaction-id", "retry-after",
]);

function uuid(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: { type: "method_not_allowed", message: "POST required" } }, 405);
  }

  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  if (!rateLimit(ip)) {
    return json({ error: { type: "rate_limited", message: "Too many Try-it requests. Wait a minute." } }, 429);
  }

  let payload: { slug?: string; path?: string; body?: unknown };
  try { payload = await req.json(); } catch {
    return json({ error: { type: "invalid_request", message: "Body must be JSON." } }, 400);
  }

  const { slug, path, body } = payload;
  if (!slug || typeof slug !== "string" || !path || typeof path !== "string") {
    return json({ error: { type: "invalid_request", message: "slug and path are required." } }, 400);
  }
  const rule = ALLOW[slug];
  if (!rule) {
    return json({ error: { type: "invalid_request", message: `Unknown slug: ${slug}` } }, 400);
  }
  if (!rule.pathRegex.test(path)) {
    return json({ error: { type: "invalid_request", message: `Path '${path}' does not match the allowlist for ${slug}.` } }, 400);
  }

  const apiKey = Deno.env.get("KOB_SANDBOX_API_KEY") || PUBLIC_DEMO_KEY;
  const isUsingDemoKey = apiKey === PUBLIC_DEMO_KEY;

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "x-api-version": "2026-04-01",
    "User-Agent": "kob-developer-tryit/1.0",
  };
  if (rule.method !== "GET") upstreamHeaders["Content-Type"] = "application/json";
  if (rule.idempotent) upstreamHeaders["Idempotency-Key"] = uuid();
  if (rule.fapi) {
    upstreamHeaders["x-fapi-interaction-id"] = uuid();
    upstreamHeaders["x-fapi-customer-ip-address"] = ip === "unknown" ? "203.0.113.7" : ip;
    upstreamHeaders["x-fapi-auth-date"] = new Date().toUTCString();
  }
  if (slug === "12-build-bank-data-aggregator") {
    upstreamHeaders["x-consent-id"] = "cnt_demo_aggregator";
  }

  const url = `${SANDBOX_BASE}${path}`;
  const start = performance.now();
  let upstreamStatus = 0;
  let upstreamBody: unknown = null;
  let upstreamHeadersOut: Record<string, string> = {};
  let networkError: string | null = null;

  try {
    const init: RequestInit = {
      method: rule.method,
      headers: upstreamHeaders,
      body: rule.method === "GET" ? undefined : JSON.stringify(body ?? {}),
    };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12_000);
    init.signal = ac.signal;
    const resp = await fetch(url, init);
    clearTimeout(timer);
    upstreamStatus = resp.status;
    for (const [k, v] of resp.headers.entries()) {
      if (HEADER_WHITELIST.has(k.toLowerCase())) upstreamHeadersOut[k] = v;
    }
    const text = await resp.text();
    try { upstreamBody = text ? JSON.parse(text) : null; }
    catch { upstreamBody = text; }
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }

  const ms = Math.round(performance.now() - start);
  const result = {
    request: {
      method: rule.method,
      url,
      headers: redactHeaders(upstreamHeaders),
      body: rule.method === "GET" ? null : (body ?? null),
    },
    response: networkError
      ? null
      : { status: upstreamStatus, headers: upstreamHeadersOut, body: upstreamBody },
    duration_ms: ms,
    network_error: networkError,
    using_demo_key: isUsingDemoKey,
    sandbox_base: SANDBOX_BASE,
    notice: isUsingDemoKey
      ? "Calls are authenticated with the public sandbox demo key. If your account provisions KOB_SANDBOX_API_KEY for this project, that key is used instead."
      : "Calls are authenticated with this project's KOB_SANDBOX_API_KEY.",
  };

  return json(result, 200);
});

function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...h };
  if (out.Authorization) {
    const m = out.Authorization.match(/^Bearer\s+(\S+)/);
    if (m) out.Authorization = `Bearer ${m[1].slice(0, 10)}…`;
  }
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
