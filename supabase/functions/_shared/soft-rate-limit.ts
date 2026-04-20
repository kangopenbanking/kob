/**
 * Soft, fail-open IP-based rate limiter for cost-sensitive public endpoints.
 *
 * Design rules:
 *  - ADDITIVE ONLY: never changes request/response contracts.
 *  - FAIL OPEN: any error in the limiter returns `allowed=true` so the API
 *    never goes down because rate-limit infra is unavailable.
 *  - USES EXISTING PRIMITIVES: leverages the `check_rate_limit` Postgres
 *    function and `rate_limits` table that already ship with the project.
 *
 * This is an interim measure until proper gateway-level rate limiting
 * (Cloudflare / Upstash Redis) lands. See project docs on the
 * "backend rate-limiting infrastructure gap".
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SoftLimitResult {
  allowed: boolean;
  identifier: string;
}

/**
 * Extract a stable client identifier from the request.
 * Prefers the first IP in x-forwarded-for; falls back to cf-connecting-ip,
 * then x-real-ip, then a constant bucket so the limiter still works.
 */
export function getClientIdentifier(req: Request, prefix = "ip"): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return `${prefix}:${first}`;
  }
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return `${prefix}:${cf}`;
  const xri = req.headers.get("x-real-ip");
  if (xri) return `${prefix}:${xri}`;
  return `${prefix}:unknown`;
}

/**
 * Check a soft rate limit. Always returns quickly; never throws.
 *
 * @param identifier  Stable bucket key (e.g. "ip:1.2.3.4" or "phone:+237...")
 * @param endpoint    Logical endpoint name (e.g. "translate-strings")
 * @param limit       Max requests allowed in the window
 * @param windowMin   Window length in minutes
 */
export async function softCheckRateLimit(
  identifier: string,
  endpoint: string,
  limit: number,
  windowMin: number,
): Promise<SoftLimitResult> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return { allowed: true, identifier };

    const supabase = createClient(url, key);
    const { data, error } = await supabase.rpc("check_rate_limit", {
      _client_id: identifier,
      _endpoint: endpoint,
      _limit: limit,
      _window_minutes: windowMin,
    });

    if (error) {
      // Fail OPEN — never break the API due to limiter issues.
      console.warn(`[soft-rate-limit] ${endpoint} check error:`, error.message);
      return { allowed: true, identifier };
    }
    return { allowed: data !== false, identifier };
  } catch (e) {
    console.warn(`[soft-rate-limit] ${endpoint} exception:`, e);
    return { allowed: true, identifier };
  }
}

/**
 * Standard 429 response (RFC 7807-flavored, matches docs/rate-limits.md).
 */
export function tooManyRequestsResponse(
  corsHeaders: Record<string, string>,
  retryAfterSeconds = 60,
): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      error_description:
        "Too many requests. Please slow down and try again shortly.",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
