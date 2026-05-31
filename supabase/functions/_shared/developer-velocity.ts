// Small IP-based velocity limit to complement Turnstile on developer-facing
// key-issuance endpoints. Fail-open by design (mirrors soft-rate-limit.ts).
//
// Limits are intentionally generous so they never bite a real human, but
// will throttle scripted abuse that bypasses Turnstile during enforcement.

import { corsHeaders } from "./cors.ts";
import {
  getClientIdentifier,
  softCheckRateLimit,
  tooManyRequestsResponse,
} from "./soft-rate-limit.ts";

const VELOCITY_PROFILES: Record<string, { perMinute: number; perHour: number }> = {
  "developer-register-app": { perMinute: 3, perHour: 20 },
  "sandbox-create-account": { perMinute: 3, perHour: 10 },
  "sandbox-create-api-key": { perMinute: 5, perHour: 30 },
};

/**
 * Returns a 429 Response when the caller exceeds the velocity budget for
 * `endpoint`, otherwise null. Fail-open: any limiter error → null.
 */
export async function enforceDeveloperVelocity(
  req: Request,
  endpoint: keyof typeof VELOCITY_PROFILES,
  userId?: string | null,
): Promise<Response | null> {
  const profile = VELOCITY_PROFILES[endpoint];
  if (!profile) return null;

  // Bucket by user when known (logged-in actions), else by IP.
  const identifier = userId
    ? `developer:${endpoint}:user:${userId}`
    : `${getClientIdentifier(req, "developer")}:${endpoint}`;

  const perMin = await softCheckRateLimit(identifier, `${endpoint}:1m`, profile.perMinute, 1);
  if (!perMin.allowed) return tooManyRequestsResponse(corsHeaders, 60);

  const perHr = await softCheckRateLimit(identifier, `${endpoint}:60m`, profile.perHour, 60);
  if (!perHr.allowed) return tooManyRequestsResponse(corsHeaders, 3600);

  return null;
}
