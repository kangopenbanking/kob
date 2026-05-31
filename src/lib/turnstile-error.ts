/**
 * Detects a Turnstile bot-verification failure from a Supabase edge function
 * error response, and returns a clear retryable message. Returns null when
 * the error is unrelated to Turnstile.
 *
 * Backend contract: 403 with body
 *   { error: 'turnstile_failed', reason, codes, retryable: true, message }
 */
export interface TurnstileFailure {
  reason: string | null;
  codes: string[];
  message: string;
}

export function detectTurnstileFailure(error: any): TurnstileFailure | null {
  if (!error) return null;
  try {
    const body = error.context?.body;
    if (!body) return null;
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    if (parsed?.error !== 'turnstile_failed') return null;
    return {
      reason: typeof parsed.reason === 'string' ? parsed.reason : null,
      codes: Array.isArray(parsed.codes) ? parsed.codes : [],
      message:
        typeof parsed.message === 'string' && parsed.message.length > 0
          ? parsed.message
          : 'Bot verification failed. Please complete the challenge again and retry.',
    };
  } catch {
    return null;
  }
}
