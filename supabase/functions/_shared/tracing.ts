/**
 * W3C Trace Context Level 2 helpers.
 *
 * Spec: https://www.w3.org/TR/trace-context/
 *
 * Edge functions:
 *   - extract incoming `traceparent` / `tracestate`
 *   - generate a new span when one is missing
 *   - propagate to upstream fetch() calls so bank connectors,
 *     mobile-money providers and settlement workers join the same trace
 *   - echo the resulting `traceparent` on every 2xx response
 */

const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceContext {
  traceparent: string;
  tracestate?: string;
  traceId: string;
  spanId: string;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function extractTraceContext(req: Request): TraceContext {
  const incoming = req.headers.get("traceparent") || "";
  const tracestate = req.headers.get("tracestate") || undefined;
  const m = TRACEPARENT_RE.exec(incoming);
  if (m) {
    const [, , traceId, parentSpan] = m;
    // New child span under the inherited trace id.
    const spanId = randomHex(8);
    return {
      traceparent: `00-${traceId}-${spanId}-01`,
      tracestate,
      traceId,
      spanId,
    };
  }
  // No upstream context — start a fresh trace.
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return {
    traceparent: `00-${traceId}-${spanId}-01`,
    tracestate,
    traceId,
    spanId,
  };
}

export function tracingResponseHeaders(ctx: TraceContext): Record<string, string> {
  const h: Record<string, string> = { traceparent: ctx.traceparent };
  if (ctx.tracestate) h.tracestate = ctx.tracestate;
  return h;
}

export function withTracingFetch(ctx: TraceContext): typeof fetch {
  return (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (!headers.has("traceparent")) headers.set("traceparent", ctx.traceparent);
    if (ctx.tracestate && !headers.has("tracestate")) headers.set("tracestate", ctx.tracestate);
    return fetch(input, { ...init, headers });
  };
}
