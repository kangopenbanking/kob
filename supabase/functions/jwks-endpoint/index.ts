import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // If no keys exist, generate a new RSA key pair and store it
    if (!keys || keys.length === 0) {
      try {
        const keyPair = await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
          },
          true,
          ['sign', 'verify']
        );

        const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

        const kid = `kob-${Date.now()}`;

        // Store the key in the database
        const { error: insertError } = await supabase
          .from('signing_keys')
          .insert({
            kid,
            kty: 'RSA',
            alg: 'RS256',
            use: 'sig',
            n: publicJwk.n!,
            e: publicJwk.e!,
            private_key: JSON.stringify(privateJwk),
            is_active: true,
          });

        if (insertError) {
          console.error('Error storing generated key:', insertError);
          return new Response(
            JSON.stringify({ keys: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }
          );
        }

        // Return the newly generated key
        const jwks = {
          keys: [{
            kty: 'RSA',
            use: 'sig',
            kid,
            alg: 'RS256',
            n: publicJwk.n,
            e: publicJwk.e,
          }]
        };

        return new Response(JSON.stringify(jwks), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (genError) {
        console.error('Error generating RSA key pair:', genError);
        return new Response(
          JSON.stringify({ keys: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
