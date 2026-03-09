/**
 * Safe error response helper. Logs full error server-side,
 * returns only a generic message + error_id to the client.
 */
export function safeErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
  context?: string
): Response {
  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[${errorId}]${context ? ` [${context}]` : ''} Error:`, err);
  return new Response(
    JSON.stringify({ error: 'internal_error', error_id: errorId }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
