import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

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

    // Parse form data
    const formData = await req.formData();
    const clientId = formData.get('client_id') as string;
    const request = formData.get('request') as string; // Signed JWT

    if (!clientId || !request) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'Missing required parameters: client_id and request'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify client exists and is active
    const { data: client, error: clientError } = await supabase
      .from('tpp_registrations')
      .select('client_id, client_name, software_roles, redirect_uris, is_active, institution_id, token_endpoint_auth_method, require_mtls, scope')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (clientError || !client) {
      console.error('Client verification failed:', clientError);
      return new Response(
        JSON.stringify({ 
          error: 'invalid_client',
          error_description: 'Client not found or inactive'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the signed request object (JAR)
    let requestPayload;
    try {
      // Get client's JWKS to verify signature
      let jwks;
      if (client.jwks_uri) {
        jwks = jose.createRemoteJWKSet(new URL(client.jwks_uri));
      } else if (client.jwks) {
        // Use local JWKS
        jwks = jose.createLocalJWKSet(client.jwks);
      } else {
        throw new Error('No JWKS available for client');
      }

      const { payload } = await jose.jwtVerify(request, jwks, {
        issuer: clientId,
        audience: supabaseUrl,
      });

      requestPayload = payload;

      // Validate temporal claims (FAPI requirement)
      const now = Math.floor(Date.now() / 1000);
      const nbf = requestPayload.nbf as number;
      const exp = requestPayload.exp as number;

      if (!nbf || !exp) {
        throw new Error('Missing nbf or exp claims');
      }

      if (nbf > now) {
        throw new Error('Token not yet valid (nbf)');
      }

      if (exp - nbf > 3600) {
        throw new Error('Token lifetime exceeds 60 minutes');
      }

      if (exp < now) {
        throw new Error('Token expired');
      }

    } catch (error) {
      console.error('Request object verification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request_object',
          error_description: 'Failed to verify signed request object: ' + errorMessage
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique request_uri
    const requestUri = `urn:ietf:params:oauth:request_uri:${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60000); // 60 seconds

    // Store PAR request
    const { error: insertError } = await supabase
      .from('par_requests')
      .insert({
        request_uri: requestUri,
        client_id: clientId,
        request_object: request,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to store PAR request:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'server_error',
          error_description: 'Failed to process request'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`PAR request created: ${requestUri} for client: ${clientId}`);

    return new Response(
      JSON.stringify({
        request_uri: requestUri,
        expires_in: 60
      }),
      { 
        status: 201, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in par-endpoint:', error);
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        error_description: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
