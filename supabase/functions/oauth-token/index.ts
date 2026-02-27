// Phase 3: OAuth Token Endpoint with mTLS Support
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSecureToken, verifySecret, checkRateLimit, rateLimitResponse, getRateLimitInfo, addRateLimitHeaders } from '../_shared/security.ts';
import { extractClientCertificate, validateClientCertificate, recordCertificateUsage } from '../_shared/mtls.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const formData = await req.formData();
    const grant_type = formData.get('grant_type');
    const client_id = formData.get('client_id');
    const client_secret = formData.get('client_secret');
    const code = formData.get('code');
    const refresh_token = formData.get('refresh_token');
    const redirect_uri = formData.get('redirect_uri');

    // Rate limiting - 100 requests per hour per client
    const rateLimit = await getRateLimitInfo(supabase, client_id as string, '/oauth/token', 100, 60);
    const allowed = await checkRateLimit(supabase, client_id as string, '/oauth/token', 100, 60);
    if (!allowed) {
      return rateLimitResponse(addRateLimitHeaders(corsHeaders, 100, rateLimit.remaining, rateLimit.reset));
    }

    // Validate client credentials
    const { data: client, error: clientError } = await supabase
      .from('api_clients')
      .select('*')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get TPP registration to check auth method
    const { data: tppReg } = await supabase
      .from('tpp_registrations')
      .select('id, token_endpoint_auth_method, require_mtls')
      .eq('client_id', client.client_id)
      .single();

    let certificateId: string | undefined;
    let cnfThumbprint: string | undefined;

    // Check if client requires mTLS authentication (FAPI 1.0 Advanced)
    if (tppReg?.token_endpoint_auth_method === 'tls_client_auth') {
      console.log('Client requires mTLS authentication (tls_client_auth)');
      
      // Extract client certificate from request headers
      const cert = await extractClientCertificate(req);
      
      if (!cert) {
        console.error('mTLS required but no certificate provided');
        return new Response(
          JSON.stringify({ 
            error: 'invalid_client', 
            error_description: 'Client certificate required for tls_client_auth' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate certificate against registered certificates
      const validation = await validateClientCertificate(
        supabase,
        tppReg.id,
        cert.thumbprint
      );

      if (!validation.valid) {
        console.error('Certificate validation failed:', validation.error);
        return new Response(
          JSON.stringify({ 
            error: 'invalid_client', 
            error_description: `Certificate validation failed: ${validation.error}` 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      certificateId = validation.certificateId;
      cnfThumbprint = cert.thumbprint;

      // Record certificate usage
      if (certificateId) {
        await recordCertificateUsage(supabase, certificateId);
      }

      console.log('mTLS authentication successful', { certificateId, cnfThumbprint });
      
      // Skip client_secret verification for mTLS clients
    } else {
      // Standard client_secret_basic authentication
      console.log('Using client_secret_basic authentication');
      
      // Verify client secret with bcrypt
      const secretValid = await verifySecret(client_secret as string, client.client_secret_hash);
      if (!secretValid) {
        return new Response(
          JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
      const code_verifier = formData.get('code_verifier');
      
      if (!code_verifier) {
        return new Response(
          JSON.stringify({ error: 'invalid_request', error_description: 'Missing code_verifier (PKCE required)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: authCode, error: codeError } = await supabase
        .from('authorization_codes')
        .select('*')
        .eq('code', code)
        .eq('client_id', client_id)
        .eq('used', false)
        .single();

      if (codeError || !authCode || new Date(authCode.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify PKCE code_verifier
      if (authCode.code_challenge && authCode.code_challenge_method === 'S256') {
        const encoder = new TextEncoder();
        const data = encoder.encode(code_verifier as string);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const computedChallenge = btoa(String.fromCharCode(...hashArray))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');

        if (computedChallenge !== authCode.code_challenge) {
          return new Response(
            JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid code_verifier' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Mark code as used
      await supabase
        .from('authorization_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', authCode.id);

      // Generate secure 256-bit tokens
      const access_token = generateSecureToken();
      const new_refresh_token = generateSecureToken();
      const expires_in = 3600; // 1 hour

      // Store refresh token with certificate binding
      const { data: refreshTokenData } = await supabase
        .from('refresh_tokens')
        .insert({
          token_hash: new_refresh_token,
          user_id: authCode.user_id,
          client_id: client_id,
          scope: authCode.scope,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          cnf_thumbprint: cnfThumbprint,
          certificate_id: certificateId,
        })
        .select()
        .single();

      // Store access token with certificate binding (RFC 8705)
      await supabase
        .from('access_tokens')
        .insert({
          token_hash: access_token,
          user_id: authCode.user_id,
          client_id: client_id,
          scope: authCode.scope,
          consent_id: authCode.consent_id,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          refresh_token_id: refreshTokenData?.id,
          cnf_thumbprint: cnfThumbprint, // RFC 8705 certificate binding
          certificate_id: certificateId,
        });

      // Build token response
      const tokenResponse: any = {
        access_token,
        token_type: 'Bearer',
        expires_in,
        refresh_token: new_refresh_token,
        scope: authCode.scope,
      };

      // Add cnf claim if certificate-bound (FAPI 1.0 Advanced requirement)
      if (cnfThumbprint) {
        tokenResponse.cnf = {
          'x5t#S256': cnfThumbprint
        };
        console.log('Issued certificate-bound access token (RFC 8705)');
      }

      const responseHeaders = addRateLimitHeaders(
        { ...corsHeaders, 'Content-Type': 'application/json' },
        100,
        rateLimit.remaining,
        rateLimit.reset
      );

      return new Response(
        JSON.stringify(tokenResponse),
        { status: 200, headers: responseHeaders }
      );

    } else if (grant_type === 'refresh_token') {
      // Refresh token flow
      const { data: refreshData, error: refreshError } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token_hash', refresh_token)
        .eq('client_id', client_id)
        .eq('is_revoked', false)
        .single();

      if (refreshError || !refreshData || new Date(refreshData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate secure new access token
      const access_token = generateSecureToken();
      const expires_in = 3600;

      // Inherit certificate binding from refresh token
      await supabase
        .from('access_tokens')
        .insert({
          token_hash: access_token,
          user_id: refreshData.user_id,
          client_id: client_id,
          scope: refreshData.scope,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          refresh_token_id: refreshData.id,
          cnf_thumbprint: refreshData.cnf_thumbprint,
          certificate_id: refreshData.certificate_id,
        });

      // Build token response
      const refreshTokenResponse: any = {
        access_token,
        token_type: 'Bearer',
        expires_in,
        scope: refreshData.scope,
      };

      // Add cnf claim if certificate-bound
      if (refreshData.cnf_thumbprint) {
        refreshTokenResponse.cnf = {
          'x5t#S256': refreshData.cnf_thumbprint
        };
      }

      const refreshResponseHeaders = addRateLimitHeaders(
        { ...corsHeaders, 'Content-Type': 'application/json' },
        100,
        rateLimit.remaining,
        rateLimit.reset
      );

      return new Response(
        JSON.stringify(refreshTokenResponse),
        { status: 200, headers: refreshResponseHeaders }
      );
    }

    } else if (grant_type === 'client_credentials') {
      // ─── Client Credentials Grant (M2M / External API funding) ───
      const requestedScope = (formData.get('scope') as string) || 'funding:write';

      const grantTypes = Array.isArray(client.grant_types) ? client.grant_types : [];
      if (!grantTypes.includes('client_credentials')) {
        return new Response(
          JSON.stringify({ error: 'unauthorized_client', error_description: 'client_credentials grant not enabled' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const clientScopes = Array.isArray(client.scopes) ? client.scopes : [];
      const requestedScopes = requestedScope.split(' ');
      const invalidScopes = requestedScopes.filter((s: string) => !clientScopes.includes(s));
      if (invalidScopes.length > 0) {
        return new Response(
          JSON.stringify({ error: 'invalid_scope', error_description: `Scopes not allowed: ${invalidScopes.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access_token = generateSecureToken();
      const expires_in = 3600;

      await supabase.from('access_tokens').insert({
        token_hash: access_token,
        user_id: null,
        client_id: client_id,
        scope: requestedScope,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        cnf_thumbprint: cnfThumbprint,
        certificate_id: certificateId,
      });

      const ccResponse: any = {
        access_token, token_type: 'Bearer', expires_in, scope: requestedScope,
      };
      if (cnfThumbprint) ccResponse.cnf = { 'x5t#S256': cnfThumbprint };

      return new Response(JSON.stringify(ccResponse), {
        status: 200,
        headers: addRateLimitHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }, 100, rateLimit.remaining, rateLimit.reset),
      });
    }

    return new Response(
      JSON.stringify({ error: 'unsupported_grant_type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Security Fix: Generic error response with secure logging
    console.error('[SECURE] OAuth token error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new Response(
      JSON.stringify({
        error: 'server_error',
        error_description: 'Unable to process token request. Please contact support.',
        error_id: errorId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
