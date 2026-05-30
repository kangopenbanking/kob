import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

// Convert ArrayBuffer to base64url
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active signing keys
    const { data: keys, error } = await supabase
      .from('signing_keys')
      .select('kid, kty, alg, use, n, e')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching signing keys:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve signing keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no keys exist, we no longer auto-generate a private key into the
    // database. RSA private signing material must be provisioned via a
    // dedicated admin rotation flow (stored in Supabase Vault / KMS), and
    // only the PUBLIC components (n, e, kid, alg, use, kty) get written to
    // the `signing_keys` table. Returning an empty JWKS is the correct
    // behaviour until an operator provisions the first key.
    if (!keys || keys.length === 0) {
      console.warn('[jwks-endpoint] No active signing keys present. Provision one via the admin rotation flow.');
      return new Response(
        JSON.stringify({ keys: [] }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        },
      );
    }

    // Return existing keys
    const jwks = {
      keys: keys.map(key => ({
        kty: key.kty,
        use: key.use,
        kid: key.kid,
        alg: key.alg,
        n: key.n,
        e: key.e,
      }))
    };

    return new Response(JSON.stringify(jwks), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Unexpected error in jwks-endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
