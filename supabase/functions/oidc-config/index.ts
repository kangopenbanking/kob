import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const apiBase = `${supabaseUrl}/functions/v1`;
    const issuer = `${supabaseUrl}/auth/v1`;

    const config = {
      issuer,
      authorization_endpoint: `${apiBase}/oauth-authorize`,
      token_endpoint: `${apiBase}/oauth-token`,
      userinfo_endpoint: `${apiBase}/userinfo`,
      jwks_uri: `${apiBase}/jwks-endpoint`,
      registration_endpoint: `${apiBase}/dcr-register`,
      pushed_authorization_request_endpoint: `${apiBase}/par-endpoint`,
      revocation_endpoint: `${apiBase}/oauth-revoke`,
      introspection_endpoint: `${apiBase}/oauth-introspect`,

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

      service_documentation: 'https://kangopenbanking.com/documentation',
      ui_locales_supported: ['en', 'fr'],
    };

    return new Response(JSON.stringify(config, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
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
