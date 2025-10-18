import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format keys for JWKS
    const jwks = {
      keys: keys?.map(key => ({
        kty: key.kty,
        use: key.use,
        kid: key.kid,
        alg: key.alg,
        n: key.n,
        e: key.e,
      })) || []
    };

    return new Response(JSON.stringify(jwks), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Unexpected error in jwks-endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
