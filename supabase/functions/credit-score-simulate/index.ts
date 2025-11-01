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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { simulation_type, amount } = await req.json();

    console.log('Simulating credit score impact for user:', user.id);

    // Get current credit score
    const { data: creditScore } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (!creditScore) {
      throw new Error('No credit score found');
    }

    const currentScore = creditScore.score;
    let predictedScore = currentScore;
    let scoreChange = 0;

    // Simple simulation logic based on type
    switch (simulation_type) {
      case 'loan_payoff':
        // Paying off loan improves amounts owed significantly
        const loanImpact = Math.min(amount / 10000, 50); // Up to 50 points
        scoreChange = Math.round(loanImpact);
        predictedScore = Math.min(currentScore + scoreChange, 850);
        break;

      case 'savings_deposit':
        // Depositing improves savings behavior
        const savingsImpact = Math.min(amount / 50000, 30); // Up to 30 points
        scoreChange = Math.round(savingsImpact);
        predictedScore = Math.min(currentScore + scoreChange, 850);
        break;

      case 'new_account':
        // Opening new account has mixed impact (short-term decrease, long-term benefit)
        scoreChange = -5; // Initial inquiry impact
        predictedScore = Math.max(currentScore + scoreChange, 300);
        break;

      case 'payment_skip':
        // Missing payment severely impacts score
        scoreChange = -45;
        predictedScore = Math.max(currentScore + scoreChange, 300);
        break;

      default:
        throw new Error('Invalid simulation type');
    }

    // Store simulation
    const { data: simulation, error: simError } = await supabase
      .from('credit_score_simulations')
      .insert({
        user_id: user.id,
        simulation_type,
        input_parameters: { amount },
        current_score: currentScore,
        predicted_score: predictedScore,
        score_change: scoreChange,
      })
      .select()
      .single();

    if (simError) {
      throw simError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        current_score: currentScore,
        predicted_score: predictedScore,
        score_change: scoreChange,
        simulation: simulation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error simulating credit score:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to simulate credit score', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
