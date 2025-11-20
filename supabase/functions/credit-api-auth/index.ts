import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { api_key, api_secret } = body;

    if (!api_key || !api_secret) {
      return new Response(
        JSON.stringify({ error: 'api_key and api_secret are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticating API client:', api_key);

    // Lookup client by API key
    const { data: client, error: clientError } = await supabase
      .from('credit_api_clients')
      .select('*')
      .eq('api_key', api_key)
      .eq('is_active', true)
      .single();

    if (clientError || !client) {
      console.error('Client not found or inactive:', clientError);
      return new Response(
        JSON.stringify({ error: 'Invalid API credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API secret
    const secretMatch = await bcrypt.compare(api_secret, client.api_secret_hash);

    if (!secretMatch) {
      console.error('Invalid API secret for client:', api_key);
      return new Response(
        JSON.stringify({ error: 'Invalid API credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate proper JWT token with HMAC-SHA256 signing
    const jwtKey = await getJwtKey();
    
    const tokenPayload = {
      client_id: client.id,
      api_key: client.api_key,
      institution_id: client.institution_id,
      allowed_operations: client.allowed_operations,
      pricing_tier: client.pricing_tier,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    };

    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      tokenPayload,
      jwtKey
    );

    // Update last query time
    await supabase
      .from('credit_api_clients')
      .update({ last_query_at: new Date().toISOString() })
      .eq('id', client.id);

    console.log('API client authenticated successfully:', client.client_name);

    return new Response(
      JSON.stringify({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        client_info: {
          client_id: client.id,
          client_name: client.client_name,
          pricing_tier: client.pricing_tier,
          allowed_operations: client.allowed_operations,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error authenticating API client:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Authentication failed', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
