/**
 * Structured JSON logger for edge functions (Phase 5 — Observability).
 *
 * Every log line is a single JSON object on stdout so Supabase log drains
 * and downstream SIEM tooling can parse without regex. A `trace_id` is
 * always attached so a request can be followed across:
 *   HTTP → charge processing → webhook delivery → ledger posting.
 *
 * Standing Order 4 (Surgeon Rule): additive only. This module is brand new
 * and does not alter any existing logging helper. Existing console.log calls
 * keep working — new code should prefer `createLogger`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  trace_id: string;
  request_id?: string;
  function?: string;
  merchant_id?: string;
  user_id?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  child: (extra: Record<string, unknown>) => Logger;
  context: LogContext;
}

const TRACE_HEADER = "X-Trace-Id";
const REQ_HEADER = "X-Request-Id";

/**
 * Extract or generate a trace id. Accepts either `X-Trace-Id`
 * or `traceparent` (W3C Trace Context — first chunk after version).
 */
export function getOrCreateTraceId(req: Request): string {
  const direct = req.headers.get(TRACE_HEADER);
  if (direct && /^[a-zA-Z0-9-]{8,128}$/.test(direct)) return direct;

  const tp = req.headers.get("traceparent");
  if (tp) {
    const parts = tp.split("-");
    if (parts.length >= 2 && /^[0-9a-f]{32}$/i.test(parts[1])) return parts[1];
  }
  return crypto.randomUUID();
}

export function injectTraceHeaders(headers: Headers, ctx: LogContext): Headers {
  if (ctx.trace_id) headers.set(TRACE_HEADER, ctx.trace_id);
  if (ctx.request_id) headers.set(REQ_HEADER, ctx.request_id);
  return headers;
}

function emit(level: LogLevel, ctx: LogContext, msg: string, fields?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
    ...(fields ?? {}),
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export function createLogger(ctx: LogContext): Logger {
  const make = (context: LogContext): Logger => ({
    context,
    debug: (m, f) => emit("debug", context, m, f),
    info: (m, f) => emit("info", context, m, f),
    warn: (m, f) => emit("warn", context, m, f),
    error: (m, f) => emit("error", context, m, f),
    child: (extra) => make({ ...context, ...extra }),
  });
  return make(ctx);
}
