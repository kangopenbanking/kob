/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Uses S256 method exclusively per FAPI 1.0 Advanced requirement
 * 
 * Standards: RFC 7636, FAPI 1.0 Advanced Section 5.2.2
 */

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a cryptographically random code_verifier
 * Returns a 43-128 character base64url string (RFC 7636 Section 4.1)
 */
export function generateCodeVerifier(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer.buffer);
}

/**
 * Generate the code_challenge from a code_verifier using S256 method
 * code_challenge = BASE64URL(SHA-256(code_verifier))
 * (RFC 7636 Section 4.2)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer.buffer);
}

/**
 * Generate a random nonce for ID token replay protection
 */
export function generateNonce(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer.buffer);
}

/**
 * Build a complete PKCE parameter set for an authorization request
 */
export async function buildPKCEParams() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const nonce = generateNonce();

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256' as const,
    state,
    nonce,
  };
}
