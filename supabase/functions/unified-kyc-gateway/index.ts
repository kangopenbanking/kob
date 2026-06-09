// Unified KYC Gateway — Youverify primary, self-hosted fallback.
// Implements: Adapter pattern, Circuit Breaker, Feature Flags, Structured logging, Audit.
//
// Routes (POST):
//   /kyc/verify   → individual KYC
//   /kyb/verify   → business KYB
//   /aml/screen   → AML screening
// Route (GET):
//   /kyc/status/:user_id
//
// Mobile apps continue calling existing endpoints; those wrappers (kept untouched)
// may delegate here. This function is the single entry point for new integrations.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types — KYCProviderInterface (canonical KOB format)
// ─────────────────────────────────────────────────────────────────────────────
type VerificationType = "identity" | "business" | "aml";
type VerificationResult = "approved" | "rejected" | "pending" | "manual_review";

export interface KycRequest {
  trace_id: string;
  user_id: string;
  verification_type: VerificationType;
  country: string;
  payload: Record<string, unknown>;
}

export interface KycResponse {
  trace_id: string;
  provider: "youverify" | "self_hosted";
  fallback_triggered: boolean;
  result: VerificationResult;
  risk_score?: number;
  session_id?: string;
  reference?: string;
  raw?: Record<string, unknown>;
  error?: { code: string; message: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured logging (no PII — user_id and trace_id only)
// ─────────────────────────────────────────────────────────────────────────────
function logKyc(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "kyc-gateway", ...entry }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flag Service — 60s TTL cache
// ─────────────────────────────────────────────────────────────────────────────
type FlagRow = {
  flag_key: string;
  is_enabled: boolean;
  rollout_percentage: number;
  country_codes: string[];
  user_whitelist: string[];
};

const FLAG_TTL_MS = 60_000;
let flagCache: { at: number; flags: Record<string, FlagRow> } | null = null;

async function loadFlags(supabase: ReturnType<typeof createClient>): Promise<Record<string, FlagRow>> {
  if (flagCache && Date.now() - flagCache.at < FLAG_TTL_MS) return flagCache.flags;
  const { data, error } = await supabase.from("kyc_feature_flags").select("*");
  if (error) {
    logKyc({ event: "flags_load_failed", error: error.message });
    return flagCache?.flags ?? {};
  }
  const flags: Record<string, FlagRow> = {};
  for (const row of (data ?? []) as FlagRow[]) flags[row.flag_key] = row;
  flagCache = { at: Date.now(), flags };
  return flags;
}

// Consistent hash 0–99 from user_id
function userBucket(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

async function shouldRouteToYouverify(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  country: string,
): Promise<{ route: boolean; reason: string }> {
  const flags = await loadFlags(supabase);
  const global = flags["youverify.global"];
  if (!global?.is_enabled) return { route: false, reason: "global_disabled" };

  const countries = flags["youverify.countries"];
  if (countries?.country_codes?.length && !countries.country_codes.includes(country.toUpperCase())) {
    return { route: false, reason: "country_not_allowed" };
  }

  const rollout = flags["youverify.rollout"];
  if (rollout?.user_whitelist?.includes(userId)) return { route: true, reason: "whitelist" };
  const pct = rollout?.rollout_percentage ?? 0;
  if (pct <= 0) return { route: false, reason: "rollout_zero" };
  if (pct >= 100) return { route: true, reason: "rollout_full" };
  return userBucket(userId) < pct
    ? { route: true, reason: `rollout_${pct}` }
    : { route: false, reason: `rollout_skip_${pct}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker (DB-persisted, single-row per provider)
// ─────────────────────────────────────────────────────────────────────────────
const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 30_000;
const OPEN_DURATION_MS = 60_000;

type BreakerState = { state: "closed" | "open" | "half_open"; failure_count: number; window_started_at: string; opened_at: string | null };

async function getBreaker(supabase: ReturnType<typeof createClient>): Promise<BreakerState> {
  const { data } = await supabase.from("kyc_circuit_breaker_state").select("*").eq("provider", "youverify").maybeSingle();
  return (data as BreakerState) ?? { state: "closed", failure_count: 0, window_started_at: new Date().toISOString(), opened_at: null };
}

async function breakerAllow(supabase: ReturnType<typeof createClient>): Promise<{ allow: boolean; state: BreakerState["state"] }> {
  const b = await getBreaker(supabase);
  if (b.state === "closed") return { allow: true, state: "closed" };
  if (b.state === "open") {
    const openedMs = b.opened_at ? Date.now() - new Date(b.opened_at).getTime() : 0;
    if (openedMs >= OPEN_DURATION_MS) {
      await supabase.from("kyc_circuit_breaker_state").update({ state: "half_open", updated_at: new Date().toISOString() }).eq("provider", "youverify");
      return { allow: true, state: "half_open" };
    }
    return { allow: false, state: "open" };
  }
  // half_open: allow one probe
  return { allow: true, state: "half_open" };
}

async function breakerRecord(supabase: ReturnType<typeof createClient>, success: boolean) {
  const b = await getBreaker(supabase);
  if (success) {
    await supabase.from("kyc_circuit_breaker_state").update({
      state: "closed", failure_count: 0, window_started_at: new Date().toISOString(), opened_at: null, updated_at: new Date().toISOString(),
    }).eq("provider", "youverify");
    return;
  }
  const now = Date.now();
  const winStart = new Date(b.window_started_at).getTime();
  const insideWindow = now - winStart < FAILURE_WINDOW_MS;
  const failures = insideWindow ? b.failure_count + 1 : 1;
  const winStartIso = insideWindow ? b.window_started_at : new Date().toISOString();
  const shouldOpen = failures >= FAILURE_THRESHOLD || b.state === "half_open";
  await supabase.from("kyc_circuit_breaker_state").update({
    state: shouldOpen ? "open" : "closed",
    failure_count: failures,
    window_started_at: winStartIso,
    opened_at: shouldOpen ? new Date().toISOString() : null,
    last_failure_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("provider", "youverify");
}

// ─────────────────────────────────────────────────────────────────────────────
// Youverify Adapter
// ─────────────────────────────────────────────────────────────────────────────
const YV_BASE = Deno.env.get("YOUVERIFY_BASE_URL") ?? "https://api.sandbox.youverify.co";
const YV_KEY = Deno.env.get("YOUVERIFY_API_KEY") ?? "";
const YV_TIMEOUT_MS = 30_000;

class YouverifyError extends Error {
  constructor(public retryable: boolean, public code: string, message: string, public status?: number) {
    super(message);
  }
}

async function callYouverify(path: string, body: unknown): Promise<Record<string, unknown>> {
  if (!YV_KEY) throw new YouverifyError(false, "missing_api_key", "YOUVERIFY_API_KEY not configured");
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), YV_TIMEOUT_MS);
  try {
    const res = await fetch(`${YV_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: YV_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* keep raw */ }
    if (res.status === 429) throw new YouverifyError(true, "rate_limited", "Youverify rate limited", 429);
    if (res.status === 401) throw new YouverifyError(false, "auth_failed", "Youverify auth failed", 401);
    if (res.status === 400) throw new YouverifyError(false, "validation_error", String(json.message ?? "bad request"), 400);
    if (res.status >= 500) throw new YouverifyError(true, "upstream_error", `Youverify ${res.status}`, res.status);
    if (!res.ok) throw new YouverifyError(false, "unexpected_status", `Youverify ${res.status}`, res.status);
    return json;
  } catch (err) {
    if (err instanceof YouverifyError) throw err;
    if ((err as Error).name === "AbortError") throw new YouverifyError(true, "timeout", "Youverify request timed out");
    throw new YouverifyError(true, "network_error", (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}

function transformToYouverify(req: KycRequest): { path: string; body: Record<string, unknown> } {
  const p = req.payload as Record<string, string>;
  switch (req.verification_type) {
    case "identity": {
      // National ID example; extend per document_type as needed.
      const docType = (p.document_type ?? "national_id").toLowerCase();
      const path = docType.includes("passport")
        ? "/v2/api/identity/ng/passport"
        : docType.includes("driver") ? "/v2/api/identity/ng/drivers-license"
        : "/v2/api/identity/ng/nin";
      return {
        path,
        body: {
          id: p.document_number,
          isSubjectConsent: true,
          firstName: p.first_name,
          lastName: p.last_name,
          dateOfBirth: p.date_of_birth,
          metadata: { trace_id: req.trace_id, user_id: req.user_id },
        },
      };
    }
    case "business":
      return {
        path: "/v2/api/verifications/global/company-advance-check",
        body: {
          registrationNumber: p.registration_number,
          countryCode: req.country,
          companyName: p.business_name,
          isConsent: true,
          metadata: { trace_id: req.trace_id, user_id: req.user_id },
        },
      };
    case "aml":
      return {
        path: "/v2/api/verifications/global/aml-screening",
        body: {
          firstName: p.first_name,
          lastName: p.last_name,
          dateOfBirth: p.date_of_birth,
          metadata: { trace_id: req.trace_id, user_id: req.user_id },
        },
      };
  }
}

function transformFromYouverify(req: KycRequest, raw: Record<string, unknown>): KycResponse {
  const data = (raw.data ?? raw) as Record<string, unknown>;
  const status = String(data.status ?? raw.statusCode ?? "").toLowerCase();
  let result: VerificationResult = "manual_review";
  if (["found", "approved", "verified", "successful", "success"].includes(status)) result = "approved";
  else if (["not_found", "rejected", "failed"].includes(status)) result = "rejected";
  else if (["pending", "in_progress"].includes(status)) result = "pending";
  const risk = typeof data.riskScore === "number" ? data.riskScore as number : undefined;
  return {
    trace_id: req.trace_id,
    provider: "youverify",
    fallback_triggered: false,
    result,
    risk_score: risk,
    session_id: (data.id ?? data.requestId) as string | undefined,
    reference: data.reference as string | undefined,
    raw: data,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-hosted Adapter — invokes existing KOB edge functions unchanged
// ─────────────────────────────────────────────────────────────────────────────
async function callSelfHosted(
  supabase: ReturnType<typeof createClient>,
  authToken: string,
  req: KycRequest,
): Promise<KycResponse> {
  const fnMap: Record<VerificationType, string> = {
    identity: "kyc-submit",
    business: "business-kyc-submit",
    aml: "gateway-compliance-screen",
  };
  const fn = fnMap[req.verification_type];
  const { data, error } = await supabase.functions.invoke(fn, {
    body: req.payload,
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (error) throw new Error(`self_hosted_${fn}: ${error.message}`);
  const d = (data ?? {}) as Record<string, unknown>;
  const status = String(d.status ?? d.verification_status ?? "pending").toLowerCase();
  const result: VerificationResult =
    status.includes("approv") ? "approved"
    : status.includes("reject") ? "rejected"
    : status.includes("review") ? "manual_review"
    : "pending";
  return {
    trace_id: req.trace_id,
    provider: "self_hosted",
    fallback_triggered: true,
    result,
    risk_score: typeof d.risk_score === "number" ? d.risk_score as number : undefined,
    reference: d.id as string | undefined,
    raw: d,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit writer
// ─────────────────────────────────────────────────────────────────────────────
async function writeAudit(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  const { error } = await supabase.from("kyc_verification_audit").insert(row);
  if (error) logKyc({ event: "audit_write_failed", error: error.message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway orchestrator
// ─────────────────────────────────────────────────────────────────────────────
async function runVerification(
  supabase: ReturnType<typeof createClient>,
  authToken: string,
  req: KycRequest,
): Promise<KycResponse> {
  const decision = await shouldRouteToYouverify(supabase, req.user_id, req.country);
  const breaker = await breakerAllow(supabase);
  const useYv = decision.route && breaker.allow;
  logKyc({ event: "route_decision", trace_id: req.trace_id, use_youverify: useYv, flag_reason: decision.reason, breaker: breaker.state });

  let yvTime: number | null = null;
  let yvSuccess: boolean | null = null;
  let fallbackReason: string | null = null;

  if (useYv) {
    const start = Date.now();
    try {
      const { path, body } = transformToYouverify(req);
      const raw = await callYouverify(path, body);
      yvTime = Date.now() - start;
      yvSuccess = true;
      await breakerRecord(supabase, true);
      const resp = transformFromYouverify(req, raw);
      // Persist Youverify session linkage so the async webhook can match
      // it back to a row when verification completes.
      if (req.verification_type === "identity" && resp.session_id) {
        await persistYouverifySession(supabase, req, resp);
      }
      await writeAudit(supabase, {
        trace_id: req.trace_id, user_id: req.user_id, verification_type: req.verification_type, country: req.country,
        provider_used: "youverify", fallback_triggered: false,
        youverify_success: true, youverify_response_time_ms: yvTime,
        verification_result: resp.result, risk_score: resp.risk_score ?? null,
      });
      logKyc({ event: "yv_success", trace_id: req.trace_id, ms: yvTime, result: resp.result, session_id: resp.session_id });
      return resp;
    } catch (err) {
      yvTime = Date.now() - start;
      yvSuccess = false;
      const e = err as YouverifyError;
      logKyc({ event: "yv_failure", trace_id: req.trace_id, ms: yvTime, code: e.code, retryable: e.retryable });
      if (!e.retryable) {
        // Hard failure (validation/auth/etc.) — do NOT fallback per spec
        await breakerRecord(supabase, false); // still count auth/etc? auth_failed should alert ops
        await writeAudit(supabase, {
          trace_id: req.trace_id, user_id: req.user_id, verification_type: req.verification_type, country: req.country,
          provider_used: "youverify", fallback_triggered: false,
          youverify_success: false, youverify_response_time_ms: yvTime,
          verification_result: "rejected",
          error_code: e.code, error_message: e.message,
        });
        return {
          trace_id: req.trace_id, provider: "youverify", fallback_triggered: false,
          result: "rejected", error: { code: e.code, message: e.message },
        };
      }
      await breakerRecord(supabase, false);
      fallbackReason = e.code;
    }
  } else {
    fallbackReason = breaker.allow ? decision.reason : `circuit_${breaker.state}`;
  }

  // Fallback to self-hosted
  const start = Date.now();
  try {
    const resp = await callSelfHosted(supabase, authToken, req);
    const shTime = Date.now() - start;
    await writeAudit(supabase, {
      trace_id: req.trace_id, user_id: req.user_id, verification_type: req.verification_type, country: req.country,
      provider_used: "self_hosted",
      fallback_triggered: useYv || decision.route, // true if we attempted YV first
      fallback_reason: fallbackReason,
      youverify_success: yvSuccess,
      youverify_response_time_ms: yvTime,
      self_hosted_success: true,
      self_hosted_response_time_ms: shTime,
      verification_result: resp.result,
      risk_score: resp.risk_score ?? null,
    });
    logKyc({ event: "sh_success", trace_id: req.trace_id, ms: shTime, fallback_reason: fallbackReason });
    return { ...resp, fallback_triggered: useYv || decision.route };
  } catch (err) {
    const shTime = Date.now() - start;
    const msg = (err as Error).message;
    await writeAudit(supabase, {
      trace_id: req.trace_id, user_id: req.user_id, verification_type: req.verification_type, country: req.country,
      provider_used: "self_hosted", fallback_triggered: useYv || decision.route,
      fallback_reason: fallbackReason,
      youverify_success: yvSuccess, youverify_response_time_ms: yvTime,
      self_hosted_success: false, self_hosted_response_time_ms: shTime,
      verification_result: "manual_review",
      error_code: "self_hosted_error", error_message: msg,
    });
    logKyc({ event: "sh_failure", trace_id: req.trace_id, ms: shTime, error: msg });
    return {
      trace_id: req.trace_id, provider: "self_hosted", fallback_triggered: true,
      result: "manual_review", error: { code: "self_hosted_error", message: "Verification temporarily unavailable. Please try again shortly." },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP entry
// ─────────────────────────────────────────────────────────────────────────────
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/unified-kyc-gateway/, "") || "/";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized", message: "Missing Authorization header" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "unauthorized", message: "Invalid token" }, 401);

  try {
    // GET /kyc/status/:user_id
    if (req.method === "GET" && path.startsWith("/kyc/status/")) {
      const targetUserId = path.split("/").pop()!;
      if (targetUserId !== user.id) {
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) return json({ error: "forbidden" }, 403);
      }
      const { data } = await supabase
        .from("kyc_verifications").select("verification_status, verified_at, youverify_session_id, document_type")
        .eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return json({ user_id: targetUserId, status: data?.verification_status ?? "not_started", details: data });
    }

    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }
    const verification_type: VerificationType =
      path.includes("/kyb/") ? "business" :
      path.includes("/aml/") ? "aml" : "identity";
    const endpoint = `POST ${verification_type}`;

    // ── Idempotency: cache full responses for retries (24h TTL) ──
    const idemKeyRaw = req.headers.get("idempotency-key") ?? req.headers.get("Idempotency-Key");
    const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let requestHash = "";
    if (idemKeyRaw) {
      if (!UUID_V4.test(idemKeyRaw) || idemKeyRaw.length > 255) {
        return json({ error: "invalid_idempotency_key", message: "Idempotency-Key must be a UUID v4" }, 400);
      }
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
      requestHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: cached } = await supabase
        .from("kyc_gateway_idempotency")
        .select("request_hash, response_status, response_body")
        .eq("idempotency_key", idemKeyRaw)
        .eq("user_id", user.id)
        .eq("endpoint", endpoint)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        if (cached.request_hash !== requestHash) {
          return new Response(JSON.stringify({
            type: "https://api.kangopenbanking.com/errors/idempotency-key-reused",
            title: "Idempotency Key Conflict",
            status: 409,
            detail: "The provided Idempotency-Key was previously used with a different request body.",
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/problem+json", "X-Idempotency-Status": "conflict_rejected" },
          });
        }
        return new Response(JSON.stringify(cached.response_body), {
          status: cached.response_status,
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotency-Status": "replayed", "X-Idempotent-Replay": "true" },
        });
      }
    }

    const trace_id = (body.trace_id as string) ?? crypto.randomUUID();
    const kycReq: KycRequest = {
      trace_id,
      user_id: user.id,
      verification_type,
      country: ((body.country ?? body.document_country ?? "CM") as string).toUpperCase(),
      payload: body,
    };
    const resp = await runVerification(supabase, token, kycReq);
    const status = resp.error ? 422 : 200;

    if (idemKeyRaw) {
      await supabase.from("kyc_gateway_idempotency").insert({
        idempotency_key: idemKeyRaw,
        user_id: user.id,
        endpoint,
        request_hash: requestHash,
        response_status: status,
        response_body: resp,
        trace_id,
      });
    }

    return new Response(JSON.stringify(resp), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...(idemKeyRaw ? { "X-Idempotency-Status": "first_request", "X-Idempotent-Replay": "false" } : {}),
      },
    });
  } catch (err) {
    logKyc({ event: "gateway_error", error: (err as Error).message });
    return json({ error: "internal_error", message: "Verification service unavailable" }, 500);
  }

});
