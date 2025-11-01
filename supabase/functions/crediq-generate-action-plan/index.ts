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

    const { user_id } = await req.json();

    // Fetch user data
    const [creditScore, kycData, loanAccounts, savingsAccounts] = await Promise.all([
      supabase.from('credit_scores').select('*').eq('user_id', user_id).eq('status', 'active').single(),
      supabase.from('kyc_verifications').select('*').eq('user_id', user_id).single(),
      supabase.from('loan_accounts').select('*').eq('user_id', user_id),
      supabase.from('savings_accounts').select('*').eq('user_id', user_id)
    ]);

    const actions = [];

    // Action 1: Complete KYC if not done
    if (!kycData.data || kycData.data.verification_status !== 'approved') {
      actions.push({
        user_id,
        action_type: 'complete_kyc',
        action_title: 'Complete KYC Verification',
        action_description: 'Verify your identity to boost your credit score and unlock more features.',
        estimated_impact: 50,
        priority: 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Action 2: Open savings account if none
    if (!savingsAccounts.data || savingsAccounts.data.length === 0) {
      actions.push({
        user_id,
        action_type: 'open_savings',
        action_title: 'Open a Savings Account',
        action_description: 'Start building your savings to improve your financial stability score.',
        estimated_impact: 40,
        priority: 'high',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Action 3: Make on-time payments
    if (loanAccounts.data && loanAccounts.data.some(l => l.arrears_days > 0)) {
      actions.push({
        user_id,
        action_type: 'make_payment',
        action_title: 'Bring Loan Payments Up to Date',
        action_description: 'Clear any outstanding payments to significantly improve your payment history.',
        estimated_impact: 60,
        priority: 'high',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });
    } else if (loanAccounts.data && loanAccounts.data.length > 0) {
      actions.push({
        user_id,
        action_type: 'maintain_payments',
        action_title: 'Continue Making On-Time Payments',
        action_description: 'Keep up your excellent payment history to maintain and grow your score.',
        estimated_impact: 30,
        priority: 'medium',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Action 4: Reduce debt if high utilization
    if (loanAccounts.data && loanAccounts.data.length > 0) {
      const totalDebt = loanAccounts.data.reduce((sum, l) => sum + (Number(l.outstanding_balance) || 0), 0);
      const totalLimit = loanAccounts.data.reduce((sum, l) => sum + (Number(l.approved_amount) || 0), 0);
      
      if (totalLimit > 0 && (totalDebt / totalLimit) > 0.5) {
        actions.push({
          user_id,
          action_type: 'reduce_debt',
          action_title: 'Pay Down Debt by 20%',
          action_description: 'Reducing your debt utilization to below 50% will boost your score significantly.',
          estimated_impact: 45,
          priority: 'high',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }

    // Action 5: Set up automatic payments
    actions.push({
      user_id,
      action_type: 'setup_auto_pay',
      action_title: 'Set Up Automatic Payments',
      action_description: 'Never miss a payment again by setting up automatic deductions.',
      estimated_impact: 25,
      priority: 'medium',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Insert actions (limit to top 5)
    if (actions.length > 0) {
      const { data, error } = await supabase
        .from('crediq_action_plans')
        .insert(actions.slice(0, 5))
        .select();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, actions: data, count: data.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, actions: [], count: 0, message: 'No actions needed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating action plan:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
