/**
 * Extracts a user-friendly error message from a Supabase Edge Function error.
 *
 * When supabase.functions.invoke() receives a non-2xx response, the Supabase
 * client throws a FunctionsHttpError whose `.context` is the raw `Response`
 * (v2). Reading the body requires `await response.text()` — the previous
 * `error.context.body` lookup was always undefined and surfaced as a generic
 * "Edge Function returned a non-2xx status code" toast.
 *
 * `extractEdgeFunctionError` is the sync fast-path (kept for the many
 * existing call sites); `extractEdgeFunctionErrorAsync` awaits the Response
 * body when available for accurate messages.
 */

const DEFAULT_MESSAGE = 'Something went wrong. Please try again or contact support.';

function fromLegacyBody(error: any): string | null {
  try {
    const body = error?.context?.body;
    if (body) {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      if (parsed?.error && typeof parsed.error === 'string') return parsed.error;
      if (parsed?.message && typeof parsed.message === 'string') return parsed.message;
    }
  } catch { /* ignore */ }
  return null;
}

function fromMessage(error: any, fallback?: string): string {
  if (
    typeof error?.message === 'string' &&
    error.message.includes('Edge Function returned a non-2xx status code')
  ) {
    return fallback || DEFAULT_MESSAGE;
  }
  if (typeof error?.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  return fallback || DEFAULT_MESSAGE;
}

export function extractEdgeFunctionError(error: any, fallback?: string): string {
  if (!error) return fallback || DEFAULT_MESSAGE;
  const legacy = fromLegacyBody(error);
  if (legacy) return legacy;
  return fromMessage(error, fallback);
}

export async function extractEdgeFunctionErrorAsync(
  error: any,
  fallback?: string,
): Promise<string> {
  if (!error) return fallback || DEFAULT_MESSAGE;
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.clone === 'function' && typeof ctx.text === 'function') {
      const txt = await ctx.clone().text();
      if (txt) {
        try {
          const parsed = JSON.parse(txt);
          if (parsed?.error && typeof parsed.error === 'string') return parsed.error;
          if (parsed?.message && typeof parsed.message === 'string') return parsed.message;
        } catch { /* not JSON */ }
        if (txt.length < 300) return txt;
      }
    }
  } catch { /* ignore */ }
  const legacy = fromLegacyBody(error);
  if (legacy) return legacy;
  return fromMessage(error, fallback);
}
