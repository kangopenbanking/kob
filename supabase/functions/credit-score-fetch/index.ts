import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { user_id, force_refresh = false, include_report = false } = body;

    console.log('Fetching credit score for user:', user_id);

    // Check for existing valid score
    const { data: existingScore } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    let scoreData = existingScore;

    // Calculate new score if needed
    if (!existingScore || force_refresh) {
      console.log('Calculating new credit score...');
      
      const { data: calculatedScore, error: calcError } = await supabase.functions.invoke(
        'credit-score-calculate',
        {
          body: { user_id, include_external: false }
        }
      );

      if (calcError) {
        throw new Error(`Failed to calculate score: ${calcError.message}`);
      }

      // Fetch the newly created score
      const { data: newScore } = await supabase
        .from('credit_scores')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      scoreData = newScore;
    }

    // Log as soft inquiry
    await supabase.from('credit_inquiries').insert({
      user_id,
      inquiry_type: 'soft',
      inquirer_type: 'self',
      inquirer_name: 'Self Check',
      purpose: 'score_check',
      user_consent_given: true,
      score_provided: scoreData?.score,
    });

    let reportData = null;
    if (include_report && scoreData) {
      const { data: report } = await supabase
        .from('credit_reports')
        .select('*')
        .eq('credit_score_id', scoreData.id)
        .single();

      reportData = report;
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: scoreData?.score,
        score_range: getScoreRange(scoreData?.score),
        calculated_at: scoreData?.calculated_at,
        expires_at: scoreData?.expires_at,
        score_factors: scoreData?.score_factors,
        report: reportData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching credit score:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to fetch credit score', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getScoreRange(score: number | undefined): string {
  if (!score) return 'Unknown';
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}
