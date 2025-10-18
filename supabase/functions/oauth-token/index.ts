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
    const grant_type = formData.get('grant_type');
    const client_id = formData.get('client_id');
    const client_secret = formData.get('client_secret');
    const code = formData.get('code');
    const refresh_token = formData.get('refresh_token');
    const redirect_uri = formData.get('redirect_uri');

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

    // Verify client secret (in production, use proper hashing)
    if (client.client_secret_hash !== client_secret) {
      return new Response(
        JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
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

      // Mark code as used
      await supabase
        .from('authorization_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', authCode.id);

      // Generate tokens
      const access_token = crypto.randomUUID();
      const new_refresh_token = crypto.randomUUID();
      const expires_in = 3600; // 1 hour

      // Store refresh token
      const { data: refreshTokenData } = await supabase
        .from('refresh_tokens')
        .insert({
          token_hash: new_refresh_token,
          user_id: authCode.user_id,
          client_id: client_id,
          scope: authCode.scope,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single();

      // Store access token
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
        });

      return new Response(
        JSON.stringify({
          access_token,
          token_type: 'Bearer',
          expires_in,
          refresh_token: new_refresh_token,
          scope: authCode.scope,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Generate new access token
      const access_token = crypto.randomUUID();
      const expires_in = 3600;

      await supabase
        .from('access_tokens')
        .insert({
          token_hash: access_token,
          user_id: refreshData.user_id,
          client_id: client_id,
          scope: refreshData.scope,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          refresh_token_id: refreshData.id,
        });

      return new Response(
        JSON.stringify({
          access_token,
          token_type: 'Bearer',
          expires_in,
          scope: refreshData.scope,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'unsupported_grant_type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in oauth-token:', error);
    return new Response(
      JSON.stringify({ error: 'server_error', error_description: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
