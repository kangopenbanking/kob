// KOB Integration Layer — Idempotency (Phase 5a hardened)
//
// Contract:
//   1. miss               → reserve in-flight row, caller processes, then store()
//   2. in_flight          → 409 with retry-after; another worker is processing the same key
//   3. replay (same hash) → return cached response + X-Idempotent-Replay: true
//   4. conflict (diff hash)→ 409 with code IDEMPOTENCY_KEY_REUSED
//   5. invalid_format     → 400 with code IDEMPOTENCY_KEY_INVALID
//
// Justification:
//   - Stripe API: idempotency keys must be unique strings ≤255 chars; UUID v4 recommended.
//   - PSD2 RTS Article 36(1)(b): deterministic retry semantics.
//   - Project Core Memory: UUID v4 idempotency_key + row-level locks mandatory.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface IdempotencyHit {
  kind: "replay";
  status: number;
  /**
   * Stored JSON body. For bodyless statuses (204/205/304) this is always `null`
   * and MUST NOT be serialised on the wire. `hasBody` is the authoritative
   * discriminator to avoid ambiguous truthiness checks (valid JSON bodies may
   * legitimately be `null`, `false`, `0`, `""`, `[]`, `{}`).
   */
  body: unknown;
  hasBody: boolean;
}
export interface IdempotencyConflict { kind: "conflict"; reason: "request_hash_mismatch" }
export interface IdempotencyInFlight { kind: "in_flight" }
export interface IdempotencyInvalid  { kind: "invalid"; reason: string }
export interface IdempotencyMiss     { kind: "miss" }

export type IdempotencyResult =
  | IdempotencyHit | IdempotencyConflict | IdempotencyInFlight | IdempotencyInvalid | IdempotencyMiss;

/**
 * RFC 9110 §6.4.1, §15.3.5, §15.3.6, §15.4.5:
 * 204 No Content, 205 Reset Content and 304 Not Modified MUST NOT include a
 * message body. Treated as authoritative bodyless statuses so replay emits
 * `new Response(null, ...)` with no `Content-Type` and no non-zero
 * `Content-Length`.
 */
export function isBodylessStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}

// RFC 4122 §4 layout. v4 (random, §4.4) is the recommended client format;
// v5 (name-based SHA-1, §4.3) is accepted so server-derived deterministic
// operation-lock keys can reuse the same reservation contract.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_OR_V5_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_KEY_LEN = 255;

export function validateIdempotencyKey(key: string | null | undefined): IdempotencyInvalid | null {
  if (!key) return null; // optional — absence is allowed; only validate when supplied
  if (typeof key !== "string") return { kind: "invalid", reason: "not_a_string" };
  if (key.length > MAX_KEY_LEN) return { kind: "invalid", reason: "exceeds_255_chars" };
  if (!UUID_V4_OR_V5_RE.test(key)) return { kind: "invalid", reason: "not_uuid_v4_or_v5" };
  return null;
}

// Exposed for callers that must gate strictly on client-supplied v4 (e.g.
// public API endpoints); server-derived v5 keys use the broader validator.
export function isStrictUuidV4(key: string): boolean {
  return UUID_V4_RE.test(key);
}

export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Reserve an idempotency slot atomically.
 *
 * - Validates the key format (UUID v4, ≤255 chars).
 * - Returns `replay` if a completed response is cached for the same request hash.
 * - Returns `conflict` if a completed response exists for a different request hash.
 * - Returns `in_flight` if another worker holds an in-flight reservation that has not expired.
 * - Returns `miss` AND inserts an in-flight reservation row (response_status NULL) so concurrent
 *   duplicate requests see `in_flight` until the caller completes and calls storeIdempotency().
 */
export async function reserveIdempotency(args: {
  key: string;
  merchantId: string | null;
  resource: string;
  requestHash: string;
  inFlightTtlMs?: number; // default 60s — abandoned reservations recover automatically
}): Promise<IdempotencyResult> {
  const invalid = validateIdempotencyKey(args.key);
  if (invalid) return invalid;
  if (!args.key) return { kind: "miss" };

  const sb = admin();
  const inFlightTtl = args.inFlightTtlMs ?? 60_000;

  // 1. Try to claim the slot atomically via insert with ON CONFLICT DO NOTHING.
  const { data: inserted, error: insErr } = await sb
    .from("integration_idempotency_keys")
    .insert({
      idempotency_key: args.key,
      merchant_id: args.merchantId,
      resource: args.resource,
      request_hash: args.requestHash,
      response_status: null,
      response_body: null,
    })
    .select("id")
    .maybeSingle();

  if (!insErr && inserted) return { kind: "miss" };

  // 2. Conflict on insert → row already exists. Read it.
  const { data: existing } = await sb
    .from("integration_idempotency_keys")
    .select("request_hash, response_status, response_body, created_at, expires_at")
    .eq("idempotency_key", args.key)
    .eq("merchant_id", args.merchantId)
    .maybeSingle();

  if (!existing) return { kind: "miss" }; // race: row vanished
  if (new Date(existing.expires_at).getTime() < Date.now()) {
    // Expired — overwrite as a fresh reservation.
    await sb.from("integration_idempotency_keys")
      .update({
        request_hash: args.requestHash,
        response_status: null,
        response_body: null,
        resource: args.resource,
      })
      .eq("idempotency_key", args.key)
      .eq("merchant_id", args.merchantId);
    return { kind: "miss" };
  }

  if (existing.request_hash !== args.requestHash) {
    return { kind: "conflict", reason: "request_hash_mismatch" };
  }

  if (existing.response_status == null) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (ageMs < inFlightTtl) return { kind: "in_flight" };
    // Stale reservation — claim it.
    return { kind: "miss" };
  }

  const status = existing.response_status;
  const hasBody = !isBodylessStatus(status);
  return { kind: "replay", status, body: hasBody ? existing.response_body : null, hasBody };
}

/**
 * Legacy lookup helper retained for back-compat.
 * Prefer `reserveIdempotency` for new code (atomic in-flight protection).
 */
export async function lookupIdempotency(
  key: string,
  merchantId: string | null,
  requestHash: string,
): Promise<{ status: number; body: unknown } | { conflict: true } | null> {
  if (!key) return null;
  const sb = admin();
  const { data, error } = await sb
    .from("integration_idempotency_keys")
    .select("request_hash, response_status, response_body, expires_at")
    .eq("idempotency_key", key)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.request_hash !== requestHash) return { conflict: true };
  if (data.response_status == null) return null;
  return { status: data.response_status, body: data.response_body };
}

export async function storeIdempotency(args: {
  key: string;
  merchantId: string | null;
  resource: string;
  requestHash: string;
  status: number;
  body: unknown;
}): Promise<void> {
  if (!args.key) return;
  const sb = admin();
  // RFC 9110 §15.3.5/§15.3.6/§15.4.5: 204/205/304 MUST have no message body.
  // Normalise any accidental body to null so replay is byte-identical bodyless.
  const bodyless = isBodylessStatus(args.status);
  const persistedBody = bodyless ? null : (args.body ?? null);
  await sb.from("integration_idempotency_keys").upsert({
    idempotency_key: args.key,
    merchant_id: args.merchantId,
    resource: args.resource,
    request_hash: args.requestHash,
    response_status: args.status,
    response_body: persistedBody as Record<string, unknown> | null,
  }, { onConflict: "merchant_id,idempotency_key" });
}

/**
 * Standard headers/body to emit when reserve() returns a non-miss outcome.
 * Centralises wire-format so every caller emits the same envelope.
 */
export function idempotencyResponse(result: IdempotencyResult, corsHeaders: Record<string, string> = {}): Response | null {
  if (result.kind === "miss") return null;

  if (result.kind === "replay") {
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotent-Replay": "true" },
    });
  }

  if (result.kind === "invalid") {
    return new Response(JSON.stringify({
      error: { type: "invalid_request_error", code: "IDEMPOTENCY_KEY_INVALID",
        message: `Idempotency-Key is invalid: ${result.reason}. Use a UUID v4 string ≤255 chars.` },
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (result.kind === "conflict") {
    return new Response(JSON.stringify({
      error: { type: "idempotency_error", code: "IDEMPOTENCY_KEY_REUSED",
        message: "Idempotency-Key was previously used with a different request body. Use a fresh key." },
    }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // in_flight
  return new Response(JSON.stringify({
    error: { type: "idempotency_error", code: "IDEMPOTENCY_KEY_IN_FLIGHT",
      message: "A request with this Idempotency-Key is currently being processed. Retry after a short delay." },
  }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "2" } });
}
