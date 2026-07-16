// Structured JSON logger + W3C-style correlation ID for KOB Edge Functions.
// Opt-in: functions import { getCorrelationId, logInfo, logWarn, logError }.

export function getCorrelationId(req: Request): string {
  const incoming =
    req.headers.get("x-correlation-id") ||
    req.headers.get("x-request-id") ||
    req.headers.get("traceparent");
  if (incoming && incoming.length <= 128) return incoming;
  // RFC 4122 v4 via crypto
  return crypto.randomUUID();
}

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  correlationId: string;
  institution_id?: string | null;
  path?: string;
  method?: string;
  actor_id?: string | null;
  [k: string]: unknown;
}

function emit(level: LogLevel, message: string, ctx: LogContext, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...ctx,
    ...(extra ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(message: string, ctx: LogContext, extra?: Record<string, unknown>) {
  emit("info", message, ctx, extra);
}

export function logWarn(message: string, ctx: LogContext, extra?: Record<string, unknown>) {
  emit("warn", message, ctx, extra);
}

export function logError(message: string, ctx: LogContext, extra?: Record<string, unknown>) {
  emit("error", message, ctx, extra);
}

export function withCorrelationHeader(
  headers: Record<string, string>,
  correlationId: string,
): Record<string, string> {
  return { ...headers, "x-correlation-id": correlationId };
}
