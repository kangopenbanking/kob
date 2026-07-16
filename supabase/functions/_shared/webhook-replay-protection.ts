// Webhook replay protection
// Dedupes incoming events by (source, event_id) using webhook_inbox with a TTL.
// First insert wins; later inserts return { duplicate: true } so the caller
// can return HTTP 200 idempotently without reprocessing the event.
//
// Header compatibility (added 2026-04-28, spec v4.17.3):
//   We accept BOTH header families:
//     X-Webhook-Signature  | Kang-Signature        (preferred)
//     X-Webhook-ID         | Kang-Event-ID / Kang-Webhook-ID (preferred)
//     X-Webhook-Timestamp  | Kang-Timestamp        (preferred)
//   Use readWebhookHeaders(req) to read whichever is present.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface ReplayCheckArgs {
  source: string;
  event_id: string | null | undefined;
  payload: unknown;
  signature?: string;
  ttl_seconds?: number; // default 24h
  /**
   * Optional SHA-256 hex fingerprint of the raw request body.
   * When provided, a subsequent delivery of the same event_id with a DIFFERENT
   * body is treated as a security-relevant mismatch (not a benign duplicate).
   */
  payload_fingerprint?: string;
  /**
   * Age (seconds) after which an unprocessed inbox row is considered abandoned
   * by a previous crashed worker and may be reclaimed by a retry. Default 90s.
   */
  stale_retry_after_seconds?: number;
}

export interface ReplayCheckResult {
  duplicate: boolean;
  /** True when the same event_id was re-delivered with a different body. */
  mismatch?: boolean;
  /** True when a prior in-flight reservation was reclaimed after a crash. */
  retried?: boolean;
  inbox_id?: string;
  reason?:
    | "missing_event_id"
    | "duplicate_within_ttl"
    | "payload_fingerprint_mismatch"
    | "stale_retry_reclaimed"
    | "ok";
}

const DEFAULT_TTL = 60 * 60 * 24; // 24h
const DEFAULT_STALE_RETRY = 90; // seconds

/**
 * SHA-256 hex fingerprint of the raw request body.
 * Runs inside Deno / Edge runtime (crypto.subtle available).
 */
export async function computePayloadFingerprint(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Enforce a symmetric replay window around the current wall-clock time.
 * Accepts either seconds-since-epoch (10-digit) or milliseconds (13-digit).
 * Returns { ok: true } when timestamp is absent (caller decides whether to require it).
 */
export function enforceReplayWindow(
  timestamp: string | number | null | undefined,
  window_seconds = 300,
  now_ms: number = Date.now(),
): { ok: true } | { ok: false; reason: "invalid_timestamp" | "outside_replay_window"; skew_seconds?: number } {
  if (timestamp === null || timestamp === undefined || timestamp === "") return { ok: true };
  const n = typeof timestamp === "number" ? timestamp : Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "invalid_timestamp" };
  const ts_ms = n < 1e12 ? n * 1000 : n; // heuristic: seconds vs ms
  const skew = Math.abs(now_ms - ts_ms) / 1000;
  if (skew > window_seconds) return { ok: false, reason: "outside_replay_window", skew_seconds: Math.round(skew) };
  return { ok: true };
}

/**
 * Reads webhook identity headers from a request, accepting both the legacy
 * X-Webhook-* family and the preferred Kang-* family. Kang-* takes precedence
 * when both are present.
 */
export function readWebhookHeaders(req: Request): {
  event_id: string | null;
  signature: string | null;
  timestamp: string | null;
  event_type: string | null;
} {
  const h = req.headers;
  const get = (...names: string[]) => {
    for (const n of names) {
      const v = h.get(n);
      if (v) return v;
    }
    return null;
  };
  return {
    event_id: get("Kang-Event-ID", "Kang-Webhook-ID", "X-Webhook-ID"),
    signature: get("Kang-Signature", "X-Webhook-Signature"),
    timestamp: get("Kang-Timestamp", "X-Webhook-Timestamp"),
    event_type: get("Kang-Event", "X-Webhook-Event"),
  };
}

/**
 * Returns the headers that should be emitted on outbound webhook deliveries
 * so subscribers can verify with either family. Always emits both.
 */
export function buildOutboundWebhookHeaders(opts: {
  signature: string;
  event_id: string;
  timestamp: string;
  event_type?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Webhook-Signature": opts.signature,
    "Kang-Signature": opts.signature,
    "X-Webhook-ID": opts.event_id,
    "Kang-Event-ID": opts.event_id,
    "Kang-Webhook-ID": opts.event_id,
    "X-Webhook-Timestamp": opts.timestamp,
    "Kang-Timestamp": opts.timestamp,
  };
  if (opts.event_type) {
    headers["X-Webhook-Event"] = opts.event_type;
    headers["Kang-Event"] = opts.event_type;
  }
  return headers;
}

export async function checkAndRegisterWebhook(
  supabase: SupabaseClient,
  args: ReplayCheckArgs,
): Promise<ReplayCheckResult> {
  const { source, event_id, payload, signature, ttl_seconds = DEFAULT_TTL } = args;
  if (!event_id) return { duplicate: false, reason: "missing_event_id" };

  const cutoff = new Date(Date.now() - ttl_seconds * 1000).toISOString();
  const { data: existing } = await supabase
    .from("webhook_inbox")
    .select("id, created_at, is_processed")
    .eq("source", source)
    .eq("event_id", event_id)
    .gte("created_at", cutoff)
    .maybeSingle();

  if (existing) {
    return { duplicate: true, inbox_id: existing.id, reason: "duplicate_within_ttl" };
  }

  const { data: inserted, error } = await supabase
    .from("webhook_inbox")
    .insert({
      source,
      event_id,
      payload: payload as Record<string, unknown>,
      signature: signature ?? null,
      is_processed: false,
    })
    .select("id")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { duplicate: true, reason: "duplicate_within_ttl" };
    }
    throw error;
  }

  return { duplicate: false, inbox_id: inserted!.id, reason: "ok" };
}

export async function markWebhookProcessed(
  supabase: SupabaseClient,
  inbox_id: string,
  error_message?: string,
): Promise<void> {
  await supabase
    .from("webhook_inbox")
    .update({
      is_processed: !error_message,
      processed_at: new Date().toISOString(),
      processing_error: error_message ?? null,
    })
    .eq("id", inbox_id);
}
