// Standardized webhook error codes & RFC-7807-aligned responses for inbound
// provider webhook receivers. Centralizing this guarantees:
//   - identical taxonomy across stripe / flutterwave / paypal receivers
//   - never leak secret material (header values, hashes, tokens) to the response
//   - pair every public response with a structured server-side log line
//
// Usage:
//   import { webhookError, WebhookErrorCode } from "../_shared/webhook-errors.ts";
//   return webhookError("invalid_signature", { provider: "stripe" }, corsHeaders);

export type WebhookErrorCode =
  | "missing_signature"
  | "invalid_signature"
  | "timestamp_expired"
  | "timestamp_missing"
  | "unsupported_event"
  | "duplicate_event"
  | "malformed_payload"
  | "rate_limit_exceeded"
  | "webhook_not_configured"
  | "verification_failed";

const CODE_META: Record<WebhookErrorCode, { status: number; title: string; detail: string }> = {
  missing_signature:      { status: 401, title: "Missing Signature",         detail: "The request did not include a signature header." },
  invalid_signature:      { status: 401, title: "Invalid Signature",         detail: "Signature verification failed." },
  timestamp_expired:      { status: 401, title: "Timestamp Expired",         detail: "Signed timestamp is outside the accepted skew window." },
  timestamp_missing:      { status: 401, title: "Timestamp Missing",         detail: "No signed timestamp was supplied for replay protection." },
  unsupported_event:      { status: 200, title: "Unsupported Event",         detail: "Event type acknowledged but not handled." },
  duplicate_event:        { status: 200, title: "Duplicate Event",           detail: "Event was already processed; no action taken." },
  malformed_payload:      { status: 400, title: "Malformed Payload",         detail: "Request body could not be parsed as a valid event." },
  rate_limit_exceeded:    { status: 429, title: "Rate Limit Exceeded",       detail: "Too many requests for this provider — slow down." },
  webhook_not_configured: { status: 503, title: "Webhook Not Configured",    detail: "Receiver is missing required server-side configuration." },
  verification_failed:    { status: 401, title: "Verification Failed",       detail: "Provider-side verification rejected the event." },
};

export interface WebhookErrorContext {
  provider: "stripe" | "flutterwave" | "paypal" | string;
  /** Optional event id for log correlation. NEVER pass header values or secrets. */
  event_id?: string | null;
  /** Optional human-readable hint. Must NOT contain secret material. */
  hint?: string;
}

/**
 * Build a Problem-JSON response for an inbound webhook failure and emit a
 * structured server log line at the same time. The response body intentionally
 * never echoes the offending header value, hash, or secret.
 */
export function webhookError(
  code: WebhookErrorCode,
  ctx: WebhookErrorContext,
  corsHeaders: Record<string, string>,
): Response {
  const meta = CODE_META[code];
  const correlation_id = crypto.randomUUID().slice(0, 12);

  // Structured server-side log — safe to ship to log aggregator.
  console.warn(JSON.stringify({
    level: "warn",
    kind: "webhook_error",
    provider: ctx.provider,
    code,
    status: meta.status,
    correlation_id,
    event_id: ctx.event_id ?? null,
    hint: ctx.hint ?? null,
    ts: new Date().toISOString(),
  }));

  const body = {
    type: `https://kangopenbanking.com/errors/${code}`,
    title: meta.title,
    status: meta.status,
    code,
    detail: meta.detail,
    provider: ctx.provider,
    correlation_id,
  };

  return new Response(JSON.stringify(body), {
    status: meta.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/problem+json",
      "X-Webhook-Error-Code": code,
      "X-Correlation-Id": correlation_id,
    },
  });
}

/** Convenience for terminal success responses with a stable shape. */
export function webhookOk(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
