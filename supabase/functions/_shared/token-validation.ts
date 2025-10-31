// Phase 4: Token Validation Middleware with mTLS Support
// RFC 8705 - Certificate-Bound Access Tokens

import { extractClientCertificate } from './mtls.ts';

export interface TokenValidationResult {
  valid: boolean;
  token?: any;
  user?: any;
  error?: string;
}

/**
 * Validate access token and enforce certificate binding (RFC 8705)
 * This function validates:
 * 1. Token exists and is not revoked
 * 2. Token has not expired
 * 3. If token is certificate-bound (cnf_thumbprint), validate the certificate
 */
export async function validateAccessToken(
  req: Request,
  supabase: any
): Promise<TokenValidationResult> {
  try {
    // Extract Bearer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return { valid: false, error: 'Missing or invalid Authorization header' };
    }

    const tokenHash = authHeader.substring(7);

    // Lookup token in database
    const { data: token, error: tokenError } = await supabase
      .from('access_tokens')
      .select(`
        *,
        users:user_id(id, email)
      `)
      .eq('token_hash', tokenHash)
      .eq('is_revoked', false)
      .single();

    if (tokenError || !token) {
      console.error('Token lookup failed:', tokenError);
      return { valid: false, error: 'Invalid or revoked access token' };
    }

    // Check expiry
    if (new Date(token.expires_at) < new Date()) {
      console.log('Access token has expired');
      return { valid: false, error: 'Access token has expired' };
    }

    // CRITICAL: Check certificate binding (RFC 8705)
    if (token.cnf_thumbprint) {
      console.log('Token has certificate binding, validating certificate...');
      
      // Extract client certificate from current request
      const cert = await extractClientCertificate(req);
      
      if (!cert) {
        console.error('Certificate-bound token used without certificate');
        return { 
          valid: false, 
          error: 'Certificate required for certificate-bound token' 
        };
      }

      // Verify thumbprint matches (RFC 8705 confirmation claim)
      if (cert.thumbprint !== token.cnf_thumbprint) {
        console.error('Certificate thumbprint mismatch:', {
          expected: token.cnf_thumbprint,
          received: cert.thumbprint,
        });
        return { 
          valid: false, 
          error: 'Certificate binding validation failed - thumbprint mismatch' 
        };
      }

      // Check certificate validity
      const now = new Date();
      if (now < cert.validFrom || now > cert.validUntil) {
        console.error('Certificate validity period invalid');
        return {
          valid: false,
          error: 'Certificate validity period invalid'
        };
      }

      console.log('Certificate binding validated successfully');
    }

    console.log('Token validation successful', {
      userId: token.user_id,
      clientId: token.client_id,
      hasCertificateBinding: !!token.cnf_thumbprint
    });

    return { 
      valid: true, 
      token,
      user: token.users
    };
  } catch (error) {
    console.error('Token validation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: `Token validation failed: ${message}` };
  }
}

/**
 * Create standardized unauthorized response
 */
export function unauthorizedResponse(
  corsHeaders: Record<string, string>,
  error: string
): Response {
  return new Response(
    JSON.stringify({ 
      error: 'invalid_token', 
      error_description: error 
    }),
    { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
