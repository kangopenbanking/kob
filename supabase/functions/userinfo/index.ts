import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'invalid_token', error_description: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' } }
      );
    }

    const token = authHeader.substring(7);

    // Look up the access token
    const { data: accessToken, error: tokenError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('token_hash', token)
      .eq('is_revoked', false)
      .single();

    if (tokenError || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'invalid_token', error_description: 'Token not found or revoked' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
      );
    }

    // Check expiry
    if (new Date(accessToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'invalid_token', error_description: 'Token expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
      );
    }

    // Check scope includes openid
    const scopes = (accessToken.scope || '').split(' ');
    if (!scopes.includes('openid')) {
      return new Response(
        JSON.stringify({ error: 'insufficient_scope', error_description: 'Token does not have openid scope' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer error="insufficient_scope"' } }
      );
    }

    // Get user profile if user_id exists
    let userClaims: Record<string, unknown> = {
      sub: accessToken.user_id || accessToken.client_id,
    };

    if (accessToken.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, updated_at')
        .eq('id', accessToken.user_id)
        .single();

      if (profile) {
        userClaims = {
          ...userClaims,
          name: profile.full_name,
          email: profile.email,
          phone_number: profile.phone,
          updated_at: profile.updated_at ? Math.floor(new Date(profile.updated_at).getTime() / 1000) : undefined,
        };
      }
    }

    return new Response(JSON.stringify(userClaims), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in userinfo:', error);
    return new Response(
      JSON.stringify({ error: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
