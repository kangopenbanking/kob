// Shared security utilities for edge functions
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

/**
 * Generate a cryptographically secure token (256-bit)
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a secret using bcrypt (for client secrets, passwords)
 */
export async function hashSecret(secret: string): Promise<string> {
  return await bcrypt.hash(secret, '12');
}

/**
 * Verify a secret against a hash
 */
export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(secret, hash);
  } catch {
    return false;
  }
}

/**
 * Rate limiting check
 */
export async function checkRateLimit(
  supabase: any,
  client_id: string,
  endpoint: string,
  limit: number,
  windowMinutes: number
): Promise<boolean> {
  const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
    _client_id: client_id,
    _endpoint: endpoint,
    _limit: limit,
    _window_minutes: windowMinutes
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open to avoid blocking legitimate requests
  }

  return allowed;
}

/**
 * Rate limit response
 */
export function rateLimitResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'rate_limit_exceeded',
      error_description: 'Too many requests. Please try again later.'
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '3600'
      }
    }
  );
}

/**
 * Validate client ID format
 */
export function isValidClientId(clientId: string): boolean {
  return /^[a-zA-Z0-9_-]{10,100}$/.test(clientId);
}

/**
 * Validate redirect URI
 */
export function isValidRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === 'https:' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Get rate limit information for a client and endpoint
 */
export async function getRateLimitInfo(
  supabase: any,
  client_id: string,
  endpoint: string,
  limit: number,
  windowMinutes: number
): Promise<{ remaining: number; reset: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const { data: rateLimits } = await supabase
    .from('rate_limits')
    .select('request_count')
    .eq('client_id', client_id)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString());

  const totalRequests = rateLimits?.reduce((sum: number, rl: any) => sum + (rl.request_count || 0), 0) || 0;
  const remaining = Math.max(0, limit - totalRequests);
  const reset = Math.floor(Date.now() / 1000) + (windowMinutes * 60);

  return { remaining, reset };
}

/**
 * Add rate limit headers to response headers
 */
export function addRateLimitHeaders(
  headers: Record<string, string>,
  limit: number,
  remaining: number,
  reset: number
): Record<string, string> {
  return {
    ...headers,
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  };
}