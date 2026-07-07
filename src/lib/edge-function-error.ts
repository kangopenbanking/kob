/**
 * Extracts a user-friendly error message from a Supabase Edge Function error.
 * 
 * When supabase.functions.invoke() receives a non-2xx response, the Supabase
 * client throws an error with a generic message: "Edge Function returned a
 * non-2xx status code". The actual error details are in error.context.body.
 * 
 * This utility extracts the real error message from the response body,
 * falling back to a professional default message.
 */

const DEFAULT_MESSAGE = 'Something went wrong. Please try again or contact support.';

export async function extractEdgeFunctionError(
  error: any,
  fallback?: string
): Promise<string> {
  if (!error) return fallback || DEFAULT_MESSAGE;

  // 1. Supabase v2 FunctionsHttpError: error.context is a Response — read body.
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.clone === "function" && typeof ctx.text === "function") {
      const txt = await ctx.clone().text();
      if (txt) {
        try {
          const parsed = JSON.parse(txt);
          if (parsed?.error && typeof parsed.error === "string") return parsed.error;
          if (parsed?.message && typeof parsed.message === "string") return parsed.message;
        } catch {
          // not JSON, fall through
        }
        if (txt.length < 300) return txt;
      }
    }
  } catch {
    // ignore, continue
  }

  // 2. Legacy shape: error.context.body already parsed/stringified.
  try {
    const body = error.context?.body;
    if (body) {
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      if (parsed?.error && typeof parsed.error === "string") return parsed.error;
      if (parsed?.message && typeof parsed.message === "string") return parsed.message;
    }
  } catch {
    // continue
  }

  if (
    typeof error.message === "string" &&
    error.message.includes("Edge Function returned a non-2xx status code")
  ) {
    return fallback || DEFAULT_MESSAGE;
  }

  if (typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }

  return fallback || DEFAULT_MESSAGE;
}
