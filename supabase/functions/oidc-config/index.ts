import { corsHeaders } from "../_shared/cors.ts";

const VERSION = "4.16.4";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const PUBLIC_API = Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1';
    const PUBLIC_SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://kangopenbanking.com';
    // Issuer is the stable, branded public site (must match clients' configured issuer).
    const issuer = PUBLIC_SITE;

    const config = {
      issuer,
      authorization_endpoint: `${PUBLIC_API}/oauth/authorize`,
      token_endpoint: `${PUBLIC_API}/oauth/token`,
      userinfo_endpoint: `${PUBLIC_API}/userinfo`,
      jwks_uri: `${PUBLIC_API}/.well-known/jwks.json`,
      registration_endpoint: `${PUBLIC_API}/oauth/register`,
      pushed_authorization_request_endpoint: `${PUBLIC_API}/oauth/par`,
      revocation_endpoint: `${PUBLIC_API}/oauth/revoke`,
      introspection_endpoint: `${PUBLIC_API}/oauth/introspect`,

      scopes_supported: ['openid', 'accounts', 'payments', 'offline_access'],
      response_types_supported: ['code', 'code id_token'],
      response_modes_supported: ['query', 'fragment', 'form_post'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],

      subject_types_supported: ['public', 'pairwise'],
      id_token_signing_alg_values_supported: ['RS256', 'PS256', 'ES256'],
      request_object_signing_alg_values_supported: ['RS256', 'PS256', 'ES256'],
      token_endpoint_auth_methods_supported: ['tls_client_auth', 'private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported: ['RS256', 'PS256', 'ES256'],

      tls_client_certificate_bound_access_tokens: true,
      require_pushed_authorization_requests: true,
      require_signed_request_object: true,

      // PKCE: S256 only (FAPI 1.0 Advanced requirement)
      code_challenge_methods_supported: ['S256'],

      claims_supported: [
        'sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti',
        'name', 'email', 'phone_number', 'updated_at'
      ],

      service_documentation: `${PUBLIC_SITE}/developer`,
      op_policy_uri: `${PUBLIC_SITE}/developer/security`,
      op_tos_uri: `${PUBLIC_SITE}/legal/terms`,
      key_rotation_policy_uri: `${PUBLIC_SITE}/developer/security#jwks-rotation`,
      ui_locales_supported: ['en', 'fr'],

      // Non-standard, reviewer-friendly metadata
      'x-version': VERSION,
      'x-fapi_profile': 'FAPI 1.0 Advanced',
      'x-health_endpoint': `${PUBLIC_API}/health`,
    };

    const body = JSON.stringify(config, null, 2);
    const etag = `"${(await sha256Hex(body)).slice(0, 16)}"`;

    // Conditional GET: short-circuit with 304 when client cache is fresh.
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          ETag: etag,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
      }
    });
  } catch (error) {
    console.error('Error in oidc-config:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
