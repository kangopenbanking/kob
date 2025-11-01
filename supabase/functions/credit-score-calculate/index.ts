import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoreComponents {
  payment_history_score: number;
  amounts_owed_score: number;
  credit_history_length_score: number;
  credit_mix_score: number;
  new_credit_score: number;
  savings_behavior_score: number;
  transaction_pattern_score: number;
  kyc_compliance_score: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { user_id, include_external = false, scoring_model = 'internal', trigger_event } = body;

    console.log('Calculating credit score for user:', user_id);

    // Fetch existing score to track changes
    const { data: existingScore } = await supabase
      .from('credit_scores')
      .select('score')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    const oldScore = existingScore?.score || null;

    // 1. Fetch loan history
    const { data: loanAccounts } = await supabase
      .from('loan_accounts')
      .select('*, loan_payments(*)')
      .eq('user_id', user_id);

    // 2. Fetch savings history
    const { data: savingsAccounts } = await supabase
      .from('savings_accounts')
      .select('*, savings_transactions(*)')
      .eq('user_id', user_id);

    // 3. Fetch transaction patterns
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(100);

    // 4. Fetch KYC data
    const { data: kycData } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .single();

    // Calculate score components
    const components: ScoreComponents = {
      payment_history_score: calculatePaymentHistory(loanAccounts || []),
      amounts_owed_score: calculateAmountsOwed(loanAccounts || [], savingsAccounts || []),
      credit_history_length_score: calculateCreditHistoryLength(loanAccounts || [], savingsAccounts || []),
      credit_mix_score: calculateCreditMix(loanAccounts || [], savingsAccounts || []),
      new_credit_score: calculateNewCredit(loanAccounts || []),
      savings_behavior_score: calculateSavingsBehavior(savingsAccounts || []),
      transaction_pattern_score: calculateTransactionPattern(transactions || []),
      kyc_compliance_score: calculateKYCCompliance(kycData),
    };

    // Calculate weighted final score
    const internalScore = Math.round(
      (components.payment_history_score * 0.35) +
      (components.amounts_owed_score * 0.30) +
      (components.credit_history_length_score * 0.15) +
      (components.credit_mix_score * 0.10) +
      (components.new_credit_score * 0.10) +
      (components.savings_behavior_score * 0.05) +
      (components.transaction_pattern_score * 0.03) +
      (components.kyc_compliance_score * 0.02)
    );

    let finalScore = internalScore;
    let externalScore = null;
    let externalBureauData = null;

    // Fetch external score if requested and KYC is verified
    if (include_external && kycData) {
      try {
        console.log('Fetching external credit data from NjangiBox...');
        const { data: externalData, error: externalError } = await supabase.functions.invoke(
          'njangibox-credit-fetch',
          {
            body: { user_id, fetch_type: 'score' }
          }
        );

        if (!externalError && externalData?.success) {
          externalScore = externalData.external_score;
          externalBureauData = externalData;
          console.log('External score fetched:', externalScore);

          // Blend internal and external scores (70% internal, 30% external)
          if (externalScore && externalScore >= 300 && externalScore <= 850) {
            finalScore = Math.round((internalScore * 0.7) + (externalScore * 0.3));
            console.log(`Blended score: ${finalScore} (Internal: ${internalScore}, External: ${externalScore})`);
          }
        }
      } catch (error) {
        console.error('Error fetching external credit data:', error);
        // Continue with internal score only
      }
    }

    const scoreData = {
      user_id,
      score: Math.max(300, Math.min(850, finalScore)),
      score_version: 'v2.0',
      scoring_model: externalScore ? 'blended' : scoring_model,
      score_factors: {
        components,
        details: {
          total_loans: loanAccounts?.length || 0,
          total_savings: savingsAccounts?.length || 0,
          total_transactions: transactions?.length || 0,
          kyc_verified: !!kycData,
          external_data_used: !!externalScore,
          blending_ratio: externalScore ? '70% internal, 30% external' : '100% internal',
        },
        external_bureau_data: externalBureauData,
      },
      confidence_level: calculateConfidence(components, !!externalScore),
      ...components,
      external_bureau_score: externalScore,
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

    // Insert new score
    const { data: creditScore, error: scoreError } = await supabase
      .from('credit_scores')
      .insert(scoreData)
      .select()
      .single();

    if (scoreError) {
      console.error('Error inserting credit score:', scoreError);
      throw scoreError;
    }

    // Record in history
    const scoreChange = oldScore ? creditScore.score - oldScore : null;
    await supabase.from('credit_score_history').insert({
      user_id,
      credit_score_id: creditScore.id,
      score: creditScore.score,
      score_change: scoreChange,
      change_reason: trigger_event || 'periodic_update',
      significant_events: { trigger_event },
    });

    // Create alert if significant change
    if (scoreChange && Math.abs(scoreChange) >= 20) {
      await supabase.from('credit_monitoring_alerts').insert({
        user_id,
        alert_type: 'score_change',
        severity: Math.abs(scoreChange) >= 50 ? 'critical' : 'warning',
        title: `Credit score ${scoreChange > 0 ? 'increased' : 'decreased'}`,
        description: `Your credit score changed by ${Math.abs(scoreChange)} points to ${creditScore.score}`,
        alert_data: { old_score: oldScore, new_score: creditScore.score, change: scoreChange },
      });
    }

    console.log('Credit score calculated successfully:', creditScore.id);

    return new Response(
      JSON.stringify({
        success: true,
        score: creditScore.score,
        score_id: creditScore.id,
        score_change: scoreChange,
        score_breakdown: components,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating credit score:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to calculate credit score', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions
function calculatePaymentHistory(loanAccounts: any[]): number {
  if (loanAccounts.length === 0) return 300; // Base score

  let totalPayments = 0;
  let onTimePayments = 0;
  let latePayments = 0;

  loanAccounts.forEach(loan => {
    const payments = loan.loan_payments || [];
    payments.forEach((payment: any) => {
      totalPayments++;
      if (payment.payment_status === 'completed') {
        onTimePayments++;
      } else if (payment.payment_status === 'late') {
        latePayments++;
      }
    });
  });

  if (totalPayments === 0) return 300;

  const onTimeRate = onTimePayments / totalPayments;
  return Math.round(300 + (onTimeRate * 550)); // 300-850 range
}

function calculateAmountsOwed(loanAccounts: any[], savingsAccounts: any[]): number {
  const totalBorrowed = loanAccounts.reduce((sum, loan) => sum + (parseFloat(loan.principal_amount) || 0), 0);
  const totalOwed = loanAccounts.reduce((sum, loan) => sum + (parseFloat(loan.outstanding_balance) || 0), 0);
  const totalSavings = savingsAccounts.reduce((sum, savings) => sum + (parseFloat(savings.balance) || 0), 0);

  if (totalBorrowed === 0) return 600; // Good if no debt

  const utilizationRatio = totalOwed / totalBorrowed;
  const savingsBuffer = totalSavings / (totalOwed || 1);

  // Lower utilization and higher savings buffer = better score
  const score = 850 - (utilizationRatio * 300) + (Math.min(savingsBuffer, 1) * 100);
  return Math.round(Math.max(300, Math.min(850, score)));
}

function calculateCreditHistoryLength(loanAccounts: any[], savingsAccounts: any[]): number {
  const allAccounts = [...loanAccounts, ...savingsAccounts];
  if (allAccounts.length === 0) return 300;

  const now = new Date();
  const ages = allAccounts.map(account => {
    const created = new Date(account.created_at);
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 365); // Years
  });

  const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
  const oldestAge = Math.max(...ages);

  // More history = better score
  const score = 300 + (Math.min(avgAge, 10) * 40) + (Math.min(oldestAge, 15) * 15);
  return Math.round(Math.min(850, score));
}

function calculateCreditMix(loanAccounts: any[], savingsAccounts: any[]): number {
  const hasLoans = loanAccounts.length > 0;
  const hasSavings = savingsAccounts.length > 0;
  const loanTypes = new Set(loanAccounts.map(l => l.loan_product_id)).size;

  let score = 300;
  if (hasLoans) score += 200;
  if (hasSavings) score += 150;
  score += Math.min(loanTypes * 50, 200); // Variety bonus

  return Math.round(Math.min(850, score));
}

function calculateNewCredit(loanAccounts: any[]): number {
  const now = new Date();
  const recentLoans = loanAccounts.filter(loan => {
    const created = new Date(loan.created_at);
    const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 180; // Last 6 months
  });

  // Too many recent loans = lower score
  const score = 850 - (Math.min(recentLoans.length, 10) * 50);
  return Math.round(Math.max(300, score));
}

function calculateSavingsBehavior(savingsAccounts: any[]): number {
  if (savingsAccounts.length === 0) return 300;

  const totalBalance = savingsAccounts.reduce((sum, s) => sum + (parseFloat(s.balance) || 0), 0);
  const avgBalance = totalBalance / savingsAccounts.length;

  // Higher savings = better score
  const score = 300 + Math.min(avgBalance / 1000, 550); // Up to 850
  return Math.round(Math.min(850, score));
}

function calculateTransactionPattern(transactions: any[]): number {
  if (transactions.length === 0) return 500; // Neutral

  const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
  const avgAmount = totalAmount / transactions.length;

  // Regular transactions with reasonable amounts = good
  const score = 500 + Math.min(transactions.length * 2, 200) + Math.min(avgAmount / 100, 150);
  return Math.round(Math.min(850, score));
}

function calculateKYCCompliance(kycData: any): number {
  if (!kycData) return 300;
  return 750; // Verified KYC = high score
}

function calculateConfidence(components: ScoreComponents, hasExternalData: boolean): number {
  const nonZeroComponents = Object.values(components).filter(v => v > 300).length;
  let confidence = (nonZeroComponents / 8) * 0.8; // Base confidence from components (0-0.8)
  
  // Boost confidence if external data is available
  if (hasExternalData) {
    confidence += 0.2; // Up to 1.0
  }
  
  return Math.round(confidence * 100) / 100; // 0-1 scale
}
