/**
 * UK Open Banking v4.0.1 Compliant Error Response Builder
 * 
 * Produces errors in the nested Errors[] format:
 * {
 *   Code: "400",
 *   Id: "err_abc123",
 *   Message: "Bad Request",
 *   Errors: [{ ErrorCode: "UK.OBIE.Field.Missing", Message: "...", Path: "...", Url: "..." }]
 * }
 * 
 * Also maintains backward compatibility with KOB flat format via dual-format support.
 */

export interface OBError {
  ErrorCode: string;
  Message: string;
  Path?: string;
  Url?: string;
}

export interface OBErrorResponse {
  Code: string;
  Id: string;
  Message: string;
  Errors: OBError[];
}

/** Standard UK OB error codes */
export const OBErrorCodes = {
  // Resource errors
  RESOURCE_NOT_FOUND: 'UK.OBIE.Resource.NotFound',
  RESOURCE_CONSENT_MISMATCH: 'UK.OBIE.Resource.ConsentMismatch',
  
  // Field errors
  FIELD_MISSING: 'UK.OBIE.Field.Missing',
  FIELD_INVALID: 'UK.OBIE.Field.Invalid',
  FIELD_INVALID_DATE: 'UK.OBIE.Field.InvalidDate',
  FIELD_UNEXPECTED: 'UK.OBIE.Field.Unexpected',
  
  // Header errors
  HEADER_MISSING: 'UK.OBIE.Header.Missing',
  HEADER_INVALID: 'UK.OBIE.Header.Invalid',
  
  // Signature errors
  SIGNATURE_MISSING: 'UK.OBIE.Signature.Missing',
  SIGNATURE_INVALID: 'UK.OBIE.Signature.Invalid',
  SIGNATURE_MALFORMED: 'UK.OBIE.Signature.Malformed',
  
  // Business logic
  RULES_INSUFFICIENT_FUNDS: 'UK.OBIE.Rules.InsufficientFunds',
  RULES_DUPLICATE_REFERENCE: 'UK.OBIE.Rules.DuplicateReference',
  
  // Auth
  UNAUTHORIZED: 'UK.OBIE.Unauthorized',
  FORBIDDEN: 'UK.OBIE.Forbidden',
} as const;

/**
 * Build a UK OB-compliant error response body.
 */
export function buildOBErrorBody(
  httpStatus: number,
  message: string,
  errors: OBError[]
): OBErrorResponse {
  return {
    Code: String(httpStatus),
    Id: `err_${crypto.randomUUID().slice(0, 8)}`,
    Message: message,
    Errors: errors,
  };
}

/**
 * Create a full Response object with UK OB error format.
 */
export function obErrorResponse(
  corsHeaders: Record<string, string>,
  httpStatus: number,
  message: string,
  errors: OBError[],
  extraHeaders?: Record<string, string>
): Response {
  const body = buildOBErrorBody(httpStatus, message, errors);
  console.error(`[${body.Id}] ${message}:`, JSON.stringify(errors));
  
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  
  // Add Retry-After for 429 responses
  if (httpStatus === 429 && !headers['Retry-After']) {
    headers['Retry-After'] = '60';
  }
  
  return new Response(JSON.stringify(body), { status: httpStatus, headers });
}

/**
 * Quick 400 Bad Request
 */
export function obBadRequest(
  corsHeaders: Record<string, string>,
  errorCode: string,
  message: string,
  path?: string
): Response {
  return obErrorResponse(corsHeaders, 400, 'Bad Request', [{
    ErrorCode: errorCode,
    Message: message,
    Path: path,
  }]);
}

/**
 * Quick 401 Unauthorized
 */
export function obUnauthorized(corsHeaders: Record<string, string>, message = 'Unauthorized'): Response {
  return obErrorResponse(corsHeaders, 401, message, [{
    ErrorCode: OBErrorCodes.UNAUTHORIZED,
    Message: message,
  }]);
}

/**
 * Quick 403 Forbidden
 */
export function obForbidden(corsHeaders: Record<string, string>, message = 'Forbidden'): Response {
  return obErrorResponse(corsHeaders, 403, message, [{
    ErrorCode: OBErrorCodes.FORBIDDEN,
    Message: message,
  }]);
}

/**
 * Quick 404 Not Found
 */
export function obNotFound(corsHeaders: Record<string, string>, resource: string): Response {
  return obErrorResponse(corsHeaders, 404, 'Not Found', [{
    ErrorCode: OBErrorCodes.RESOURCE_NOT_FOUND,
    Message: `${resource} not found`,
  }]);
}

/**
 * Quick 429 Rate Limited (with Retry-After)
 */
export function obRateLimited(corsHeaders: Record<string, string>, retryAfterSeconds = 60): Response {
  return obErrorResponse(corsHeaders, 429, 'Too Many Requests', [{
    ErrorCode: 'UK.OBIE.RateLimit',
    Message: 'Rate limit exceeded. Please retry after the specified interval.',
  }], { 'Retry-After': String(retryAfterSeconds) });
}

/**
 * Add Links.Next and Links.Prev to a UK OB response envelope.
 */
export function buildPaginationLinks(
  selfUrl: string,
  offset: number,
  limit: number,
  totalCount: number
): { Self: string; Next?: string; Prev?: string; Last?: string; First?: string } {
  const baseUrl = selfUrl.split('?')[0];
  const links: any = { Self: selfUrl };
  
  if (offset + limit < totalCount) {
    links.Next = `${baseUrl}?limit=${limit}&offset=${offset + limit}`;
  }
  if (offset > 0) {
    links.Prev = `${baseUrl}?limit=${limit}&offset=${Math.max(0, offset - limit)}`;
  }
  links.First = `${baseUrl}?limit=${limit}&offset=0`;
  const lastOffset = Math.max(0, Math.floor((totalCount - 1) / limit) * limit);
  links.Last = `${baseUrl}?limit=${limit}&offset=${lastOffset}`;
  
  return links;
}
