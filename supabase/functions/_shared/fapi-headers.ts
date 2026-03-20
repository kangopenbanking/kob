/**
 * FAPI (Financial-grade API) Header Utilities
 * Implements UK Open Banking v4.0.1 header compliance:
 *  - x-fapi-interaction-id: mandatory echo / generate
 *  - x-fapi-auth-date: optional, parsed + logged
 *  - x-fapi-customer-ip-address: optional, parsed + logged
 *  - x-customer-user-agent: optional, parsed + logged
 *
 * Usage:
 *   import { extractFapiHeaders, addFapiResponseHeaders } from "../_shared/fapi-headers.ts";
 *   const fapi = extractFapiHeaders(req);
 *   const headers = addFapiResponseHeaders(corsHeaders, fapi);
 */

export interface FapiContext {
  interactionId: string;
  authDate: string | null;
  customerIpAddress: string | null;
  customerUserAgent: string | null;
}

/**
 * Extract FAPI headers from an incoming request.
 * If x-fapi-interaction-id is absent, generate a new UUID.
 */
export function extractFapiHeaders(req: Request): FapiContext {
  const requestInteractionId = req.headers.get('x-fapi-interaction-id');
  return {
    interactionId: requestInteractionId || crypto.randomUUID(),
    authDate: req.headers.get('x-fapi-auth-date'),
    customerIpAddress: req.headers.get('x-fapi-customer-ip-address'),
    customerUserAgent: req.headers.get('x-customer-user-agent'),
  };
}

/**
 * Add FAPI-mandated response headers.
 * Always sets x-fapi-interaction-id on the response.
 */
export function addFapiResponseHeaders(
  headers: Record<string, string>,
  fapi: FapiContext
): Record<string, string> {
  return {
    ...headers,
    'x-fapi-interaction-id': fapi.interactionId,
  };
}

/**
 * Log FAPI context for audit/traceability (server-side only).
 */
export function logFapiContext(fapi: FapiContext, endpoint: string): void {
  const parts = [`[FAPI] ${endpoint} interaction=${fapi.interactionId}`];
  if (fapi.authDate) parts.push(`auth_date=${fapi.authDate}`);
  if (fapi.customerIpAddress) parts.push(`customer_ip=${fapi.customerIpAddress}`);
  if (fapi.customerUserAgent) parts.push(`user_agent=${fapi.customerUserAgent}`);
  console.log(parts.join(' '));
}
