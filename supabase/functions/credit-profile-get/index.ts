import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
      .from('credit_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: latestSnapshot } = await supabase
      .from('credit_score_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(JSON.stringify({
      profile: profile || { current_score: 500, score_band: 'C', last_computed_at: null },
      latest_snapshot: latestSnapshot,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('credit-profile-get error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
