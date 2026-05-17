/**
 * Phase 1 — X-Request-ID correlation helper.
 *
 * Standardized propagation of an X-Request-ID across edge functions, ledger
 * writes and outbound webhook deliveries. Honors a client-supplied id when
 * present (UUID v4 recommended, max 64 chars, [A-Za-z0-9._-]) and falls back
 * to a freshly generated UUID. The same id MUST be echoed back on the
 * response and persisted on `webhook_deliveries.trace_id`,
 * `gateway_charges.trace_id`, and `ledger_entries.trace_id` once Phase 5
 * adds those columns.
 *
 * Usage:
 *   const traceId = getOrCreateRequestId(req);
 *   return new Response(body, { headers: withRequestId(corsHeaders, traceId) });
 */

const REQUEST_ID_HEADER = "X-Request-ID";
const PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function getOrCreateRequestId(req: Request): string {
  const supplied = req.headers.get(REQUEST_ID_HEADER) ?? req.headers.get("x-request-id");
  if (supplied && PATTERN.test(supplied)) return supplied;
  return crypto.randomUUID();
}

export function withRequestId(
  base: HeadersInit,
  traceId: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (base instanceof Headers) {
    base.forEach((v, k) => { out[k] = v; });
  } else if (Array.isArray(base)) {
    for (const [k, v] of base) out[k] = v;
  } else {
    Object.assign(out, base);
  }
  out[REQUEST_ID_HEADER] = traceId;
  return out;
}

export const REQUEST_ID_HEADER_NAME = REQUEST_ID_HEADER;
