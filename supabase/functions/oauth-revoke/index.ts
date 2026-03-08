import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifySecret } from '../_shared/security.ts';

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

    const formData = await req.formData();
    const token = formData.get('token') as string;
    const token_type_hint = formData.get('token_type_hint') as string | null;
    const client_id = formData.get('client_id') as string;
    const client_secret = formData.get('client_secret') as string;

    // RFC 7009: respond 200 even if token is invalid
    if (!token || !client_id || !client_secret) {
      return new Response(null, { status: 200, headers: corsHeaders });
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
        JSON.stringify({ error: 'invalid_client' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secretValid = await verifySecret(client_secret, client.client_secret_hash);
    if (!secretValid) {
      return new Response(
        JSON.stringify({ error: 'invalid_client' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the token before lookup (tokens are stored as SHA-256 hashes)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Try to revoke as access token
    if (!token_type_hint || token_type_hint === 'access_token') {
      const { error } = await supabase
        .from('access_tokens')
        .update({ is_revoked: true, revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .eq('client_id', client_id);

      if (!error) {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
    }

    // Try to revoke as refresh token
    if (!token_type_hint || token_type_hint === 'refresh_token') {
      const { error } = await supabase
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .eq('client_id', client_id);

      if (!error) {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
    }

    // RFC 7009: always return 200
    return new Response(null, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error in oauth-revoke:', error);
    return new Response(null, { status: 200, headers: corsHeaders });
  }
});
