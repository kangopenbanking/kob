// Step-up MFA helper for sensitive admin actions.
//
// Validates that the caller's JWT was minted with AAL2 (i.e. they completed
// an MFA challenge) within MAX_AGE_SECONDS. If not, returns a 401 Response
// the caller can return as-is, AND writes a `step_up_denied` audit row so
// the attempt is recorded even when the action itself never runs.
//
// Why not RBAC-only? The MFA policy memory mandates a fresh MFA assertion
// for state-changing admin actions; passing a role check is necessary but
// not sufficient.

import { corsHeaders } from "./cors.ts";

const MAX_AGE_SECONDS = 600; // 10 minutes — admin review windows can be slow

interface JwtPayload {
  aal?: string;
  amr?: Array<{ method?: string; timestamp?: number }>;
  exp?: number;
  iat?: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 ? "=".repeat(4 - (padded.length % 4)) : "";
    const json = atob(padded + pad);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export interface StepUpResult {
  ok: boolean;
  aal?: string;
  methods?: string[];
  age_seconds?: number;
  reason?: string;
}

export function checkStepUp(token: string): StepUpResult {
  const payload = decodeJwt(token);
  if (!payload) return { ok: false, reason: "invalid_token" };
  const aal = payload.aal ?? "aal1";
  if (aal !== "aal2") return { ok: false, aal, reason: "aal2_required" };
  const amr = Array.isArray(payload.amr) ? payload.amr : [];
  const methods = amr.map((m) => m.method ?? "").filter(Boolean);
  const mfaMethods = methods.filter((m) =>
    ["totp", "phone", "webauthn", "sms", "recovery_code", "backup_code"].includes(m)
  );
  if (mfaMethods.length === 0) return { ok: false, aal, methods, reason: "no_mfa_method" };
  const latest = amr.reduce((acc, m) => Math.max(acc, m.timestamp ?? 0), 0);
  if (!latest) return { ok: false, aal, methods, reason: "no_mfa_timestamp" };
  const age = Math.floor(Date.now() / 1000) - latest;
  if (age > MAX_AGE_SECONDS) {
    return { ok: false, aal, methods, age_seconds: age, reason: "mfa_stale" };
  }
  return { ok: true, aal, methods: mfaMethods, age_seconds: age };
}

export interface StepUpDeniedAudit {
  user_id: string;
  action_type: string; // e.g. 'admin_kyc_review.step_up_denied'
  entity_type: string;
  entity_id?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
}

export async function recordStepUpDenied(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  row: StepUpDeniedAudit,
): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id ?? null,
      performed_by: row.user_id,
      details: { reason: row.reason, ...(row.metadata ?? {}) },
    });
  } catch (e) {
    console.error("step-up audit insert failed", e);
  }
}

export function stepUpDeniedResponse(result: StepUpResult): Response {
  return new Response(
    JSON.stringify({
      error: "step_up_required",
      code: "STEP_UP_REQUIRED",
      reason: result.reason ?? "aal2_required",
      message:
        "This action requires step-up authentication. Complete an MFA challenge (TOTP, phone, or WebAuthn) within the last 10 minutes and retry.",
      aal: result.aal ?? null,
      max_age_seconds: MAX_AGE_SECONDS,
    }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
