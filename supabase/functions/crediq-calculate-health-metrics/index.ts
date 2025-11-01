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

    const { user_id, credit_score_id } = await req.json();

    // Fetch credit score data
    const { data: creditScore, error: scoreError } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('id', credit_score_id)
      .single();

    if (scoreError || !creditScore) {
      throw new Error('Credit score not found');
    }

    // Fetch financial data
    const [loanAccounts, savingsAccounts, transactions] = await Promise.all([
      supabase.from('loan_accounts').select('*').eq('user_id', user_id),
      supabase.from('savings_accounts').select('*').eq('user_id', user_id),
      supabase.from('transactions').select('*').eq('user_id', user_id).order('transaction_datetime', { ascending: false }).limit(50)
    ]);

    // Calculate individual health metrics (0-100 scale)
    
    // 1. Payment Reliability Score
    let paymentReliabilityScore = 50;
    let paymentReliability = 'fair';
    
    if (loanAccounts.data && loanAccounts.data.length > 0) {
      const totalLoans = loanAccounts.data.length;
      const activeLoans = loanAccounts.data.filter(l => l.status === 'active').length;
      const onTimePayments = loanAccounts.data.filter(l => l.payment_history === 'on_time' || l.arrears_days === 0).length;
      
      paymentReliabilityScore = Math.min(100, (onTimePayments / totalLoans) * 100);
      
      if (paymentReliabilityScore >= 90) paymentReliability = 'excellent';
      else if (paymentReliabilityScore >= 75) paymentReliability = 'good';
      else if (paymentReliabilityScore >= 50) paymentReliability = 'fair';
      else paymentReliability = 'poor';
    }

    // 2. Debt Management Score
    let debtManagementScore = 70;
    let debtManagement = 'good';
    
    if (loanAccounts.data && savingsAccounts.data) {
      const totalDebt = loanAccounts.data.reduce((sum, l) => sum + (Number(l.outstanding_balance) || 0), 0);
      const totalSavings = savingsAccounts.data.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
      
      if (totalDebt === 0) {
        debtManagementScore = 100;
        debtManagement = 'excellent';
      } else {
        const debtToSavingsRatio = totalSavings / totalDebt;
        debtManagementScore = Math.min(100, debtToSavingsRatio * 100);
        
        if (debtManagementScore >= 80) debtManagement = 'excellent';
        else if (debtManagementScore >= 60) debtManagement = 'good';
        else if (debtManagementScore >= 40) debtManagement = 'fair';
        else debtManagement = 'poor';
      }
    }

    // 3. Credit Utilization Score
    let creditUtilizationScore = 80;
    let creditUtilizationPercentage = 0;
    
    if (loanAccounts.data && loanAccounts.data.length > 0) {
      const totalLimit = loanAccounts.data.reduce((sum, l) => sum + (Number(l.approved_amount) || 0), 0);
      const totalUsed = loanAccounts.data.reduce((sum, l) => sum + (Number(l.outstanding_balance) || 0), 0);
      
      if (totalLimit > 0) {
        creditUtilizationPercentage = (totalUsed / totalLimit) * 100;
        creditUtilizationScore = Math.max(0, 100 - creditUtilizationPercentage);
      }
    }

    // 4. Account Diversity Score
    let accountDiversityScore = 50;
    let accountDiversity = 'fair';
    
    const hasLoans = loanAccounts.data && loanAccounts.data.length > 0;
    const hasSavings = savingsAccounts.data && savingsAccounts.data.length > 0;
    
    if (hasLoans && hasSavings) {
      accountDiversityScore = 90;
      accountDiversity = 'excellent';
    } else if (hasLoans || hasSavings) {
      accountDiversityScore = 60;
      accountDiversity = 'good';
    } else {
      accountDiversityScore = 30;
      accountDiversity = 'poor';
    }

    // 5. Financial Stability Score
    let financialStabilityScore = 60;
    let financialStability = 'fair';
    
    if (transactions.data && transactions.data.length > 0) {
      const avgTransactionAmount = transactions.data.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) / transactions.data.length;
      const regularTransactions = transactions.data.filter(t => t.status === 'Booked').length;
      
      financialStabilityScore = Math.min(100, (regularTransactions / transactions.data.length) * 100);
      
      if (financialStabilityScore >= 80) financialStability = 'excellent';
      else if (financialStabilityScore >= 60) financialStability = 'good';
      else if (financialStabilityScore >= 40) financialStability = 'fair';
      else financialStability = 'poor';
    }

    // 6. Overall Health Score (weighted average)
    const overallHealthScore = Math.round(
      (paymentReliabilityScore * 0.30) +
      (debtManagementScore * 0.25) +
      (creditUtilizationScore * 0.20) +
      (accountDiversityScore * 0.15) +
      (financialStabilityScore * 0.10)
    );

    // Generate suggested actions
    const suggestedActions = [];
    
    if (paymentReliabilityScore < 75) {
      suggestedActions.push({
        action: 'Make on-time payments',
        impact: 'high',
        estimated_points: 50
      });
    }
    
    if (debtManagementScore < 60) {
      suggestedActions.push({
        action: 'Reduce debt or increase savings',
        impact: 'high',
        estimated_points: 40
      });
    }
    
    if (accountDiversityScore < 70) {
      suggestedActions.push({
        action: 'Open a savings account',
        impact: 'medium',
        estimated_points: 30
      });
    }

    // Insert health metrics
    const healthMetrics = {
      user_id,
      credit_score_id,
      overall_health_score: overallHealthScore,
      payment_reliability_score: Math.round(paymentReliabilityScore),
      debt_management_score: Math.round(debtManagementScore),
      credit_utilization_score: Math.round(creditUtilizationScore),
      account_diversity_score: Math.round(accountDiversityScore),
      financial_stability_score: Math.round(financialStabilityScore),
      payment_reliability: paymentReliability,
      debt_management: debtManagement,
      credit_utilization_percentage: Number(creditUtilizationPercentage.toFixed(2)),
      account_diversity: accountDiversity,
      financial_stability: financialStability,
      suggested_actions: suggestedActions,
      priority_actions: suggestedActions.slice(0, 3)
    };

    const { data, error } = await supabase
      .from('crediq_health_metrics')
      .insert(healthMetrics)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, health_metrics: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating health metrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
