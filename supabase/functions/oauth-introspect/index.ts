import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const token = formData.get('token');
    const client_id = formData.get('client_id');
    const client_secret = formData.get('client_secret');

    if (!token || !client_id || !client_secret) {
      return new Response(
        JSON.stringify({ active: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate client credentials
    const { data: client, error: clientError } = await supabase
      .from('api_clients')
      .select('*')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .single();

    if (clientError || !client || client.client_secret_hash !== client_secret) {
      return new Response(
        JSON.stringify({ active: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token exists and is valid
    const { data: accessToken, error: tokenError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('token_hash', token)
      .eq('is_revoked', false)
      .single();

    if (tokenError || !accessToken) {
      return new Response(
        JSON.stringify({ active: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const isExpired = new Date(accessToken.expires_at) < new Date();
    if (isExpired) {
      return new Response(
        JSON.stringify({ active: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token is valid
    return new Response(
      JSON.stringify({
        active: true,
        scope: accessToken.scope,
        client_id: accessToken.client_id,
        username: accessToken.user_id,
        token_type: 'Bearer',
        exp: Math.floor(new Date(accessToken.expires_at).getTime() / 1000),
        iat: Math.floor(new Date(accessToken.created_at).getTime() / 1000),
        sub: accessToken.user_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in oauth-introspect:', error);
    return new Response(
      JSON.stringify({ active: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
