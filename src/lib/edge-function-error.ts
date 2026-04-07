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

export function extractEdgeFunctionError(
  error: any,
  fallback?: string
): string {
  if (!error) return fallback || DEFAULT_MESSAGE;

  // 1. Try to extract from error.context.body (Supabase FunctionsHttpError)
  try {
    const body = error.context?.body;
    if (body) {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      if (parsed?.error && typeof parsed.error === 'string') {
        return parsed.error;
      }
      if (parsed?.message && typeof parsed.message === 'string') {
        return parsed.message;
      }
    }
  } catch {
    // JSON parse failed, continue to next strategy
  }

  // 2. If error.message is the generic Supabase message, return fallback
  if (
    typeof error.message === 'string' &&
    error.message.includes('Edge Function returned a non-2xx status code')
  ) {
    return fallback || DEFAULT_MESSAGE;
  }

  // 3. Use error.message if it's a meaningful string
  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  // 4. Last resort
  return fallback || DEFAULT_MESSAGE;
}
