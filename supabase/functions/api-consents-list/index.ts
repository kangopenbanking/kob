import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AISP consents
    const { data: aispConsents } = await supabase
      .from('aisp_consents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Get PISP consents
    const { data: pispConsents } = await supabase
      .from('pisp_consents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const allConsents = [
      ...(aispConsents || []).map(c => ({ ...c, type: 'AISP' })),
      ...(pispConsents || []).map(c => ({ ...c, type: 'PISP' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(
      JSON.stringify({
        Data: {
          Consents: allConsents,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-consents-list:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
