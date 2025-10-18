const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const issuer = `${supabaseUrl}/auth/v1`;

    // OpenID Connect Discovery document aligned with FAPI 1.0 Advanced
    const config = {
      issuer,
      authorization_endpoint: `${supabaseUrl}/functions/v1/oauth-authorize`,
      token_endpoint: `${supabaseUrl}/functions/v1/token-endpoint`,
      userinfo_endpoint: `${supabaseUrl}/functions/v1/userinfo`,
      jwks_uri: `${supabaseUrl}/functions/v1/jwks-endpoint`,
      registration_endpoint: `${supabaseUrl}/functions/v1/dcr-register`,
      pushed_authorization_request_endpoint: `${supabaseUrl}/functions/v1/par-endpoint`,
      
      // Supported features
      scopes_supported: ['openid', 'accounts', 'payments', 'offline_access'],
      response_types_supported: ['code', 'code id_token'],
      response_modes_supported: ['query', 'fragment', 'form_post'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      
      // FAPI 1.0 Advanced requirements
      subject_types_supported: ['public', 'pairwise'],
      id_token_signing_alg_values_supported: ['RS256', 'PS256', 'ES256'],
      request_object_signing_alg_values_supported: ['RS256', 'PS256', 'ES256'],
      token_endpoint_auth_methods_supported: ['tls_client_auth', 'private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported: ['RS256', 'PS256', 'ES256'],
      
      // FAPI specific
      tls_client_certificate_bound_access_tokens: true,
      require_pushed_authorization_requests: true,
      require_signed_request_object: true,
      
      // Claims
      claims_supported: [
        'sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti',
        'name', 'email', 'phone_number', 'updated_at'
      ],
      
      // Additional endpoints
      revocation_endpoint: `${supabaseUrl}/functions/v1/token-revoke`,
      introspection_endpoint: `${supabaseUrl}/functions/v1/token-introspect`,
      
      // Code challenge methods for PKCE
      code_challenge_methods_supported: ['S256', 'plain'],
      
      // Service documentation
      service_documentation: 'https://docs.kangopenbanking.com',
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
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
