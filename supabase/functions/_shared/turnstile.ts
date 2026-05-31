// Cloudflare Turnstile verifier — shared helper for bot-gated endpoints.
//
// Behavior:
// - If TURNSTILE_SECRET_KEY is unset → returns { ok: true, codes: ['turnstile_disabled'] }
//   (soft-off: prototype can ship before secret is configured).
// - If TURNSTILE_ENFORCE !== 'true' → caller should treat result as advisory (shadow mode).
// - Fail-open on Cloudflare 5xx/timeout (3s) so an outage at CF cannot block signups.
// - Hardened: validates hostname allowlist, action match, and replay window
//   (challenge_ts must be within MAX_AGE_S, default 120s).
//
// Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export interface TurnstileResult {
  ok: boolean;
  codes: string[];
  reason?: string;          // structured error reason for audit logs
  hostname?: string | null; // returned by siteverify
  action?: string | null;   // returned by siteverify
  challenge_age_s?: number | null;
  shadow?: boolean;         // true when ENFORCE flag is off — caller should log only, not block
}

export function turnstileEnforceEnabled(): boolean {
  return Deno.env.get('TURNSTILE_ENFORCE') === 'true';
}

function allowedHostnames(): string[] {
  // Comma-separated env, e.g. "kob.lovable.app,kangopenbanking.com,localhost"
  const raw = Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function maxChallengeAgeSeconds(): number {
  const raw = Deno.env.get('TURNSTILE_MAX_AGE_S');
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 120;
}

export interface VerifyOpts {
  /** Expected action string set on the widget. When provided, mismatch → fail. */
  expectedAction?: string;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
  opts: VerifyOpts = {},
): Promise<TurnstileResult> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const enforce = turnstileEnforceEnabled();

  if (!secret) {
    return {
      ok: true,
      codes: ['turnstile_disabled'],
      reason: 'secret_unset_failopen',
      shadow: !enforce,
    };
  }

  if (!token || typeof token !== 'string') {
    return {
      ok: false,
      codes: ['missing-input-response'],
      reason: 'missing_token',
      shadow: !enforce,
    };
  }

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (r.status >= 500) {
      return {
        ok: true,
        codes: ['turnstile_upstream_5xx_failopen'],
        reason: 'cf_5xx_failopen',
        shadow: !enforce,
      };
    }
    const j = await r.json();
    const cfCodes = (j['error-codes'] as string[]) || [];
    const hostname: string | null = (j.hostname as string) ?? null;
    const action: string | null = (j.action as string) ?? null;
    const challengeTs: string | null = (j.challenge_ts as string) ?? null;
    let ageS: number | null = null;
    if (challengeTs) {
      const d = Date.parse(challengeTs);
      if (Number.isFinite(d)) ageS = Math.floor((Date.now() - d) / 1000);
    }

    if (!j.success) {
      return {
        ok: false,
        codes: cfCodes,
        reason: cfCodes[0] ?? 'cf_unsuccessful',
        hostname,
        action,
        challenge_age_s: ageS,
        shadow: !enforce,
      };
    }

    // Audience / site-key check via hostname allowlist
    const hostnames = allowedHostnames();
    if (hostnames.length && hostname && !hostnames.includes(hostname.toLowerCase())) {
      return {
        ok: false,
        codes: [...cfCodes, 'hostname-not-allowed'],
        reason: 'hostname_not_allowlisted',
        hostname,
        action,
        challenge_age_s: ageS,
        shadow: !enforce,
      };
    }

    // Replay window enforcement
    const maxAge = maxChallengeAgeSeconds();
    if (ageS !== null && ageS > maxAge) {
      return {
        ok: false,
        codes: [...cfCodes, 'token-expired-replay-window'],
        reason: 'replay_window_exceeded',
        hostname,
        action,
        challenge_age_s: ageS,
        shadow: !enforce,
      };
    }

    // Optional action match
    if (opts.expectedAction && action && action !== opts.expectedAction) {
      return {
        ok: false,
        codes: [...cfCodes, 'action-mismatch'],
        reason: 'action_mismatch',
        hostname,
        action,
        challenge_age_s: ageS,
        shadow: !enforce,
      };
    }

    return {
      ok: true,
      codes: cfCodes,
      reason: 'verified',
      hostname,
      action,
      challenge_age_s: ageS,
      shadow: !enforce,
    };
  } catch (_e) {
    return {
      ok: true,
      codes: ['turnstile_network_failopen'],
      reason: 'network_failopen',
      shadow: !enforce,
    };
  }
}

/**
 * Extract a Turnstile token from a request without consuming the JSON body.
 * Looks at header `x-turnstile-token` first, then a cloned-body `turnstile_token`.
 */
export async function extractTurnstileToken(req: Request): Promise<string | null> {
  const hdr = req.headers.get('x-turnstile-token');
  if (hdr) return hdr;
  try {
    const clone = req.clone();
    const body = await clone.json();
    if (body && typeof body.turnstile_token === 'string') return body.turnstile_token;
  } catch (_e) {
    // body not JSON or already consumed
  }
  return null;
}

export function clientIpFrom(req: Request): string | null {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}

/**
 * Best-effort audit log to `security_audit_logs`. Never throws.
 * Writes structured `metadata` so the admin Turnstile monitor can chart trends.
 */
export async function logTurnstileDecision(
  supabase: { from: (t: string) => any },
  params: {
    endpoint: string;
    user_id?: string | null;
    ip?: string | null;
    result: TurnstileResult;
  },
): Promise<void> {
  try {
    await supabase.from('security_audit_logs').insert({
      event_type: `turnstile.${params.endpoint}`,
      event_category: 'turnstile',
      user_id: params.user_id ?? null,
      ip_address: params.ip ?? null,
      blocked: !params.result.ok,
      risk_score: params.result.ok ? 0 : 10,
      metadata: {
        endpoint: params.endpoint,
        decision: params.result.ok ? 'allowed' : 'denied',
        reason: params.result.reason ?? null,
        codes: params.result.codes,
        hostname: params.result.hostname ?? null,
        action: params.result.action ?? null,
        challenge_age_s: params.result.challenge_age_s ?? null,
        shadow: params.result.shadow ?? false,
      },
    });
  } catch (e) {
    console.warn('[turnstile] audit log failed:', e);
  }
}
