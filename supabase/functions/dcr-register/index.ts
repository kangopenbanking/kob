import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      software_statement,
      redirect_uris,
      token_endpoint_auth_method = 'tls_client_auth',
      grant_types = ['authorization_code', 'refresh_token'],
      response_types = ['code'],
      scope = 'accounts payments'
    } = body;

    if (!software_statement) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'Missing software_statement (SSA)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode and verify Software Statement Assertion (SSA)
    let ssaPayload;
    try {
      // In production, verify against KOB Directory's public key
      // For now, we'll decode without verification for sandbox
      const decoded = jose.decodeJwt(software_statement);
      ssaPayload = decoded;

      // Validate required SSA claims
      if (!ssaPayload.software_id || !ssaPayload.software_client_name || !ssaPayload.software_roles) {
        throw new Error('Invalid SSA: missing required claims');
      }

    } catch (error) {
      console.error('SSA verification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ 
          error: 'invalid_software_statement',
          error_description: 'Failed to verify or decode SSA: ' + errorMessage
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate client credentials using secure 256-bit tokens
    const clientId = `tpp_${crypto.randomUUID()}`;
    const clientSecret = generateSecureToken();
    
    // Hash the client secret before storing
    const clientSecretHash = await hashSecret(clientSecret);

    // Check if institution exists for this software_id
    const { data: institution } = await supabase
      .from('institutions')
      .select('id')
      .eq('registration_number', ssaPayload.software_id as string)
      .single();

    // Create TPP registration
    const { data: registration, error: regError } = await supabase
      .from('tpp_registrations')
      .insert({
        client_id: clientId,
        client_secret: clientSecretHash,
        institution_id: institution?.id || null,
        client_name: ssaPayload.software_client_name as string,
        software_id: ssaPayload.software_id as string,
        software_statement,
        software_roles: ssaPayload.software_roles as string[],
        redirect_uris: redirect_uris || ssaPayload.software_redirect_uris || [],
        grant_types,
        response_types,
        token_endpoint_auth_method,
        jwks_uri: ssaPayload.software_jwks_endpoint as string || null,
        jwks: body.jwks || null,
        scope,
        environment: 'sandbox', // Default to sandbox
      })
      .select()
      .single();

    if (regError) {
      console.error('Failed to create TPP registration:', regError);
      return new Response(
        JSON.stringify({ 
          error: 'server_error',
          error_description: 'Failed to register client'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`TPP registered: ${clientId} (${ssaPayload.software_client_name})`);

    // Return registration response
    const response = {
      client_id: registration.client_id,
      client_secret: registration.client_secret,
      client_name: registration.client_name,
      software_id: registration.software_id,
      software_roles: registration.software_roles,
      redirect_uris: registration.redirect_uris,
      grant_types: registration.grant_types,
      response_types: registration.response_types,
      token_endpoint_auth_method: registration.token_endpoint_auth_method,
      jwks_uri: registration.jwks_uri,
      scope: registration.scope,
      environment: registration.environment,
      client_id_issued_at: Math.floor(new Date(registration.created_at).getTime() / 1000),
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Unexpected error in dcr-register:', error);
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        error_description: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
