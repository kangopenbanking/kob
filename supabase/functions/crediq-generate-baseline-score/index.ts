import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id } = await req.json();
    console.log('Generating baseline score for user:', user_id);

    // Fetch questionnaire profile
    const { data: profile, error: profileError } = await supabase
      .from('crediq_user_profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (profileError || !profile) {
      throw new Error('No questionnaire profile found');
    }

    // Check if user has actual transaction history
    const { data: loanAccounts } = await supabase
      .from('loan_accounts')
      .select('id')
      .eq('user_id', user_id)
      .limit(1);

    const { data: savingsAccounts } = await supabase
      .from('savings_accounts')
      .select('id')
      .eq('user_id', user_id)
      .limit(1);

    const hasTransactionHistory = (loanAccounts && loanAccounts.length > 0) || 
                                  (savingsAccounts && savingsAccounts.length > 0);

    let baselineScore = 300; // Minimum
    let confidence = 0.3; // Low confidence for questionnaire-only

    if (hasTransactionHistory) {
      // User has KOB history - use full calculation
      console.log('User has transaction history, using full credit calculation');
      
      try {
        const { data: fullScoreResponse, error: fullScoreError } = await supabase.functions.invoke('credit-score-calculate', {
          body: { user_id, include_external: true, trigger_event: 'crediq_onboarding' }
        });
        
        if (fullScoreError) throw fullScoreError;
        
        const fullScore = fullScoreResponse?.score || 300;
        
        // Trigger follow-up actions
        await supabase.functions.invoke('crediq-generate-action-plan', {
          body: { user_id }
        });
        
        await supabase.functions.invoke('crediq-emails', {
          body: { action: 'send-welcome-email', user_id, credit_score: fullScore }
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            score: fullScore,
            score_type: 'full_calculation',
            confidence: 0.8,
            message: 'Score calculated from your transaction history'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (calculatorError) {
        console.error('Full calculator failed, falling back to baseline:', calculatorError);
        // Continue to baseline calculation below
      }
    }

    // Calculate baseline score from questionnaire
    const scoreComponents = {
      employment: 0,
      income: 0,
      financial_obligations: 0,
      banking: 0,
      credit_history: 0,
      savings: 0,
      goals: 0
    };

    // Employment status (0-60 points)
    const employmentScores: Record<string, number> = {
      'employed': 60,
      'self_employed': 50,
      'retired': 40,
      'student': 30,
      'unemployed': 0
    };
    scoreComponents.employment = employmentScores[profile.employment_status] || 0;

    // Income level (0-80 points)
    const incomeScores: Record<string, number> = {
      '>1M': 80,
      '500k-1M': 70,
      '250k-500k': 60,
      '100k-250k': 50,
      '<100k': 30
    };
    scoreComponents.income = incomeScores[profile.monthly_income_range] || 0;

    // Financial obligations (0-60 points) - inverse scoring
    if (!profile.has_existing_loans) {
      scoreComponents.financial_obligations = 60;
    } else {
      const obligationScores: Record<string, number> = {
        '<50k': 50,
        '50k-100k': 40,
        '100k-200k': 30,
        '>200k': 20
      };
      scoreComponents.financial_obligations = obligationScores[profile.monthly_loan_obligations_range || ''] || 30;
    }

    // Banking behavior (0-70 points)
    if (profile.has_bank_account) scoreComponents.banking += 35;
    if (profile.uses_mobile_money) scoreComponents.banking += 35;

    // Savings behavior (0-80 points)
    const savingsScores: Record<string, number> = {
      '>100k': 80,
      '50k-100k': 70,
      '10k-50k': 50,
      '<10k': 30,
      'none': 0
    };
    scoreComponents.savings = savingsScores[profile.average_monthly_savings_range || ''] || 0;

    // Credit history (0-100 points)
    if (profile.has_previous_loans) {
      const paymentHistoryScores: Record<string, number> = {
        'always_on_time': 100,
        'mostly_on_time': 80,
        'sometimes_late': 50,
        'often_late': 20
      };
      scoreComponents.credit_history = paymentHistoryScores[profile.loan_payment_history || ''] || 50;
      
      if (profile.has_defaulted_loans) {
        scoreComponents.credit_history -= 40; // Penalty for defaults
      }
    } else {
      scoreComponents.credit_history = 50; // Neutral for no history
    }

    // Goals (0-50 points) - shows financial awareness
    scoreComponents.goals = 50;

    // Calculate total baseline score
    baselineScore = 300 + Object.values(scoreComponents).reduce((sum, score) => sum + score, 0);
    baselineScore = Math.min(650, Math.max(300, baselineScore)); // Cap at 650 for baseline

    // Store baseline score
    const scoreData = {
      user_id,
      score: baselineScore,
      score_version: 'baseline_v1.0',
      scoring_model: 'questionnaire',
      score_factors: {
        components: scoreComponents,
        details: {
          source: 'questionnaire',
          has_transaction_history: false,
          questionnaire_version: profile.questionnaire_version
        }
      },
      confidence_level: confidence,
      calculated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      next_update_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    };

    // Deactivate old scores
    await supabase
      .from('credit_scores')
      .update({ status: 'expired' })
      .eq('user_id', user_id)
      .eq('status', 'active');

    // Insert new baseline score
    const { data: creditScore, error: scoreError } = await supabase
      .from('credit_scores')
      .insert(scoreData)
      .select()
      .single();

    if (scoreError) throw scoreError;

    // Record in history
    await supabase.from('credit_score_history').insert({
      user_id,
      credit_score_id: creditScore.id,
      score: creditScore.score,
      score_change: null,
      change_reason: 'baseline_score_generated',
      significant_events: { source: 'questionnaire' },
    });

    // Mark profile as baseline generated
    await supabase
      .from('crediq_user_profiles')
      .update({ baseline_score_generated: true })
      .eq('user_id', user_id);

    // Generate initial action plan
    try {
      await supabase.functions.invoke('crediq-generate-action-plan', {
        body: { user_id }
      });
    } catch (e) {
      console.error('Error generating action plan:', e);
    }

    // Send welcome email
    try {
      await supabase.functions.invoke('crediq-send-welcome-email', {
        body: { user_id, baseline_score: baselineScore }
      });
    } catch (e) {
      console.error('Error sending welcome email:', e);
    }

    console.log('Baseline score generated:', baselineScore);

    return new Response(
      JSON.stringify({
        success: true,
        score: baselineScore,
        score_type: 'baseline',
        confidence,
        score_breakdown: scoreComponents,
        message: 'Baseline score generated from questionnaire. Complete more activities to improve accuracy.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating baseline score:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
