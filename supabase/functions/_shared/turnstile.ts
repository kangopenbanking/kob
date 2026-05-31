// Cloudflare Turnstile verifier — shared helper for bot-gated endpoints.
//
// Behavior:
// - If TURNSTILE_SECRET_KEY is unset → returns { ok: true, codes: ['turnstile_disabled'] }
//   (soft-off: prototype can ship before secret is configured).
// - If TURNSTILE_ENFORCE !== 'true' → caller should treat result as advisory (shadow mode).
// - Fail-open on Cloudflare 5xx/timeout (3s) so an outage at CF cannot block signups.
//
// Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export interface TurnstileResult {
  ok: boolean;
  codes: string[];
  shadow?: boolean; // true when ENFORCE flag is off — caller should log only, not block
}

export function turnstileEnforceEnabled(): boolean {
  return Deno.env.get('TURNSTILE_ENFORCE') === 'true';
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const enforce = turnstileEnforceEnabled();

  if (!secret) {
    return { ok: true, codes: ['turnstile_disabled'], shadow: !enforce };
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, codes: ['missing-input-response'], shadow: !enforce };
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
      // Fail-open on CF outage
      return { ok: true, codes: ['turnstile_upstream_5xx_failopen'], shadow: !enforce };
    }
    const j = await r.json();
    return {
      ok: !!j.success,
      codes: (j['error-codes'] as string[]) || [],
      shadow: !enforce,
    };
  } catch (_e) {
    // Network/timeout → fail-open
    return { ok: true, codes: ['turnstile_network_failopen'], shadow: !enforce };
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
      action: 'turnstile_check',
      decision: params.result.ok ? 'allowed' : 'denied',
      user_id: params.user_id ?? null,
      ip_address: params.ip ?? null,
      metadata: {
        endpoint: params.endpoint,
        codes: params.result.codes,
        shadow: params.result.shadow ?? false,
      },
    });
  } catch (e) {
    console.warn('[turnstile] audit log failed:', e);
  }
}
