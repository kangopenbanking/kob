import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { error: checkError } = await supabase.rpc('check_api_key_expiration');
    if (checkError) throw checkError;

    console.log('API key expiration check completed');

    return new Response(
      JSON.stringify({ success: true, message: 'Expiration checks completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error checking API key expiration:', error);
    return problem(500, 'Internal Server Error', error.message);
  }
});
