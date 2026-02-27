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

    const { data: snapshot } = await supabase
      .from('credit_score_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snapshot) {
      return new Response(JSON.stringify({
        score: 500,
        band: 'C',
        factors: [],
        summary: 'No credit history yet. Your score starts at the baseline of 500.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const factors = snapshot.factors_json || [];
    const positive = factors.filter((f: any) => f.total_impact > 0);
    const negative = factors.filter((f: any) => f.total_impact < 0);

    let summary = `Your credit score is ${snapshot.score} (${snapshot.score_band} band). `;
    if (positive.length > 0) {
      summary += `Positive: ${positive.map((f: any) => f.description).join('; ')}. `;
    }
    if (negative.length > 0) {
      summary += `Areas to improve: ${negative.map((f: any) => f.description).join('; ')}.`;
    }
    if (positive.length === 0 && negative.length === 0) {
      summary += 'Limited credit activity detected.';
    }

    return new Response(JSON.stringify({
      score: snapshot.score,
      band: snapshot.score_band,
      factors,
      summary,
      computed_at: snapshot.computed_at,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
