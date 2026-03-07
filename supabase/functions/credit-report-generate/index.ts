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

    const body = await req.json();
    const {
      user_id,
      report_type = 'full',
      requester_type = 'self',
      requester_id = null,
      purpose = 'general_review',
    } = body;

    console.log('Generating credit report for user:', user_id, 'type:', report_type);

    // Get or calculate latest credit score
    const { data: scoreResponse } = await supabase.functions.invoke(
      'credit-score-fetch',
      { body: { user_id } }
    );

    const { data: creditScore } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Fetch comprehensive data
    const [
      { data: loanAccounts },
      { data: savingsAccounts },
      { data: accounts },
      { data: kycData },
      { data: inquiries },
    ] = await Promise.all([
      supabase.from('loan_accounts').select('*').eq('user_id', user_id),
      supabase.from('savings_accounts').select('*').eq('user_id', user_id),
      supabase.from('accounts').select('*').eq('user_id', user_id),
      supabase.from('kyc_verifications').select('*').eq('user_id', user_id).eq('status', 'approved').single(),
      supabase.from('credit_inquiries').select('*').eq('user_id', user_id).order('inquiry_date', { ascending: false }).limit(20),
    ]);

    // Calculate report metrics
    const totalLoans = loanAccounts?.length || 0;
    const activeLoans = loanAccounts?.filter(l => l.status === 'active').length || 0;
    const completedLoans = loanAccounts?.filter(l => l.status === 'closed' || l.status === 'completed').length || 0;
    const defaultedLoans = loanAccounts?.filter(l => l.status === 'defaulted').length || 0;

    const totalBorrowed = loanAccounts?.reduce((sum, l) => sum + parseFloat(l.principal_amount || 0), 0) || 0;
    const totalBalance = loanAccounts?.reduce((sum, l) => sum + parseFloat(l.outstanding_balance || 0), 0) || 0;
    const totalRepaid = totalBorrowed - totalBalance;

    const totalSavingsAccounts = savingsAccounts?.length || 0;
    const totalSavingsBalance = savingsAccounts?.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0) || 0;

    const totalAccounts = accounts?.length || 0;
    const activeAccounts = accounts?.filter(a => a.is_active).length || 0;

    // Calculate inquiry counts
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const hardInquiries6m = inquiries?.filter(i => 
      i.inquiry_type === 'hard' && new Date(i.inquiry_date) >= sixMonthsAgo
    ).length || 0;

    const hardInquiries12m = inquiries?.filter(i => 
      i.inquiry_type === 'hard' && new Date(i.inquiry_date) >= twelveMonthsAgo
    ).length || 0;

    const softInquiriesTotal = inquiries?.filter(i => i.inquiry_type === 'soft').length || 0;

    // Calculate real late payment metrics from loan_payments
    const { data: paymentHistory, error: paymentError } = await supabase
      .from('loan_payments')
      .select('*, loan_accounts!inner(user_id)')
      .eq('loan_accounts.user_id', user_id);

    if (paymentError) {
      console.error('Error fetching payment history:', paymentError);
    }

    let late30Days = 0;
    let late60Days = 0;
    let late90Days = 0;
    let missedPayments = 0;

    for (const payment of paymentHistory || []) {
      if (payment.status === 'overdue' || payment.status === 'late') {
        const dueDate = new Date(payment.created_at);
        const daysLate = Math.floor(
          (new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysLate >= 90) {
          late90Days++;
        } else if (daysLate >= 60) {
          late60Days++;
        } else if (daysLate >= 30) {
          late30Days++;
        }
      } else if (payment.status === 'missed' || payment.status === 'defaulted') {
        missedPayments++;
      }
    }

    // Create credit report
    const reportData = {
      user_id,
      report_type,
      credit_score_id: creditScore?.id,
      
      personal_info_verified: !!kycData,
      employment_verified: !!kycData?.employment_status,
      income_verified: !!kycData?.monthly_income,
      
      total_accounts: totalAccounts,
      active_accounts: activeAccounts,
      closed_accounts: totalAccounts - activeAccounts,
      total_credit_limit: totalBorrowed,
      total_balance: totalBalance,
      credit_utilization_ratio: totalBorrowed > 0 ? (totalBalance / totalBorrowed) * 100 : 0,
      
      total_loans: totalLoans,
      active_loans: activeLoans,
      completed_loans: completedLoans,
      defaulted_loans: defaultedLoans,
      total_borrowed: totalBorrowed,
      total_repaid: totalRepaid,
      on_time_payment_rate: completedLoans > 0 ? (completedLoans / (completedLoans + defaultedLoans)) * 100 : 100,
      
      total_savings_accounts: totalSavingsAccounts,
      total_savings_balance: totalSavingsBalance,
      average_monthly_savings: totalSavingsAccounts > 0 ? totalSavingsBalance / totalSavingsAccounts : 0,
      savings_consistency_score: calculateSavingsConsistency(savingsAccounts || []),
      
      late_payments_30_days: late30Days,
      late_payments_60_days: late60Days,
      late_payments_90_days: late90Days,
      missed_payments: missedPayments,
      total_payments_made: (paymentHistory || []).length,
      
      hard_inquiries_6m: hardInquiries6m,
      hard_inquiries_12m: hardInquiries12m,
      soft_inquiries_total: softInquiriesTotal,
      
      collections: 0,
      bankruptcies: 0,
      liens: 0,
      judgments: 0,
      
      generated_by: requester_id,
      generated_at: new Date().toISOString(),
      requested_by: requester_type,
      requester_id,
      purpose,
    };

    const { data: report, error: reportError } = await supabase
      .from('credit_reports')
      .insert(reportData)
      .select()
      .single();

    if (reportError) {
      console.error('Error creating credit report:', reportError);
      throw reportError;
    }

    // Log as hard inquiry if requested by institution
    if (requester_type !== 'self') {
      await supabase.from('credit_inquiries').insert({
        user_id,
        inquiry_type: 'hard',
        inquirer_type: requester_type,
        inquirer_name: requester_type,
        inquirer_id: requester_id,
        purpose,
        user_consent_given: true,
        score_provided: creditScore?.score,
        report_provided: true,
        report_id: report.id,
      });

      // Create alert for user
      await supabase.from('credit_monitoring_alerts').insert({
        user_id,
        alert_type: 'new_inquiry',
        severity: 'info',
        title: 'New credit report generated',
        description: `A ${requester_type} requested your credit report for ${purpose}`,
        alert_data: { report_id: report.id, requester_type, purpose },
      });
    }

    console.log('Credit report generated successfully:', report.id);

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        score: creditScore?.score,
        report_summary: {
          total_accounts: report.total_accounts,
          active_loans: report.active_loans,
          total_borrowed: report.total_borrowed,
          total_savings: report.total_savings_balance,
          hard_inquiries: report.hard_inquiries_6m,
        },
        report: report_type === 'full' ? report : null,
        generated_at: report.generated_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating credit report:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate credit report', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateSavingsConsistency(savingsAccounts: any[]): number {
  if (savingsAccounts.length === 0) return 0;
  
  // Simple consistency score based on number of accounts and balances
  const avgBalance = savingsAccounts.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0) / savingsAccounts.length;
  return Math.min(100, Math.round((avgBalance / 10000) * 100)); // 0-100 scale
}
