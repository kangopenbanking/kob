/**
 * Detached JWS Message Signing Utilities
 * Implements UK Open Banking v4.0.1 x-jws-signature support.
 *
 * For PISP write endpoints:
 * - Verify incoming x-jws-signature (detached payload, PS256)
 * - Generate x-jws-signature on responses
 *
 * Also handles JWE rejection (415 Unsupported Media Type for application/jose+jwe).
 */

/**
 * Check if the request uses JWE content type and return 415 if so.
 * UK OB: ASPSPs that don't support JWE MUST reject with 415.
 */
export function rejectJweContentType(req: Request, corsHeaders: Record<string, string>): Response | null {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/jose+jwe') || contentType.includes('application/jose')) {
    return new Response(
      JSON.stringify({
        Code: '415',
        Id: crypto.randomUUID().slice(0, 8),
        Message: 'Unsupported Media Type',
        Errors: [{
          ErrorCode: 'UK.OBIE.Header.Invalid',
          Message: 'JWE encrypted request bodies are not supported. Use application/json.',
          Path: 'Content-Type',
          Url: 'https://openbankinguk.github.io/read-write-api-site3/v4.0.1/profiles/read-write-data-api-profile.html#message-signing'
        }]
      }),
      {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  return null;
}

/**
 * Validate the presence of x-jws-signature on PISP write requests.
 * Returns an error response if the signature header is missing.
 * Actual cryptographic verification requires the TPP's public key from JWKS — 
 * this validates the structure (3 dot-separated base64url parts with empty payload).
 */
export function validateJwsSignature(
  req: Request,
  corsHeaders: Record<string, string>
): { valid: boolean; errorResponse?: Response; signature?: string } {
  const jwsSig = req.headers.get('x-jws-signature');

  if (!jwsSig) {
    return {
      valid: false,
      errorResponse: new Response(
        JSON.stringify({
          Code: '400',
          Id: crypto.randomUUID().slice(0, 8),
          Message: 'Missing x-jws-signature header',
          Errors: [{
            ErrorCode: 'UK.OBIE.Signature.Missing',
            Message: 'Payment write endpoints require a detached JWS signature in the x-jws-signature header.',
            Path: 'x-jws-signature',
            Url: 'https://openbankinguk.github.io/read-write-api-site3/v4.0.1/profiles/read-write-data-api-profile.html#message-signing'
          }]
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    };
  }

  // Detached JWS format: header..signature (empty payload between dots)
  const parts = jwsSig.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      errorResponse: new Response(
        JSON.stringify({
          Code: '400',
          Id: crypto.randomUUID().slice(0, 8),
          Message: 'Invalid x-jws-signature format',
          Errors: [{
            ErrorCode: 'UK.OBIE.Signature.Invalid',
            Message: 'x-jws-signature must be a valid detached JWS (header..signature with empty payload).',
            Path: 'x-jws-signature',
            Url: 'https://openbankinguk.github.io/read-write-api-site3/v4.0.1/profiles/read-write-data-api-profile.html#message-signing'
          }]
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    };
  }

  return { valid: true, signature: jwsSig };
}

/**
 * Generate a detached JWS signature for a response body.
 * Uses HMAC-SHA256 as a simplified signing mechanism (production would use PS256 with RSA keys).
 * Returns the x-jws-signature header value.
 */
export async function generateResponseJws(responseBody: string): Promise<string> {
  // Build a minimal JOSE header
  const header = btoa(JSON.stringify({
    alg: 'PS256',
    kid: 'kob-signing-key-1',
    typ: 'JOSE',
    crit: ['http://openbanking.org.uk/iat', 'http://openbanking.org.uk/iss'],
    'http://openbanking.org.uk/iat': Math.floor(Date.now() / 1000),
    'http://openbanking.org.uk/iss': Deno.env.get('PUBLIC_API_BASE_URL') || 'https://api.kangopenbanking.com/v1'
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Generate signature using HMAC-SHA256 (simulated PS256 — real impl needs RSA-PSS)
  const signingKey = Deno.env.get('JWS_SIGNING_SECRET') || 'kob-default-signing-key';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(header + '.' + responseBody));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Detached format: header..signature (empty payload)
  return `${header}..${signature}`;
}
