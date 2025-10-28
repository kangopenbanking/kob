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
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { loan_account_id, amount, payment_method, notes } = body;

    console.log('Processing loan repayment:', { loan_account_id, amount, user: user.id });

    // Get loan account details
    const { data: loanAccount, error: loanError } = await supabase
      .from('loan_accounts')
      .select('*')
      .eq('id', loan_account_id)
      .eq('user_id', user.id)
      .single();

    if (loanError || !loanAccount) {
      console.error('Loan account not found:', loanError);
      return new Response(
        JSON.stringify({ error: 'Loan account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (loanAccount.status !== 'active' && loanAccount.status !== 'disbursed') {
      return new Response(
        JSON.stringify({ error: 'Loan account is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount <= 0 || amount > loanAccount.outstanding_balance) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate payment reference
    const paymentRef = `LP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Get pending schedules
    const { data: schedules, error: scheduleError } = await supabase
      .from('loan_repayment_schedules')
      .select('*')
      .eq('loan_account_id', loan_account_id)
      .eq('status', 'pending')
      .order('installment_number', { ascending: true });

    if (scheduleError) {
      console.error('Error fetching schedules:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch repayment schedule' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allocate payment to schedules
    let remainingAmount = amount;
    let totalPrincipal = 0;
    let totalInterest = 0;
    let totalPenalty = 0;

    for (const schedule of schedules) {
      if (remainingAmount <= 0) break;

      const dueAmount = schedule.total_due - schedule.total_paid + schedule.penalty_amount;
      const paymentForSchedule = Math.min(remainingAmount, dueAmount);

      // Allocate to penalty first, then interest, then principal
      let penaltyPaid = Math.min(paymentForSchedule, schedule.penalty_amount - schedule.penalty_paid);
      let interestPaid = Math.min(paymentForSchedule - penaltyPaid, schedule.interest_due - schedule.interest_paid);
      let principalPaid = paymentForSchedule - penaltyPaid - interestPaid;

      totalPenalty += penaltyPaid;
      totalInterest += interestPaid;
      totalPrincipal += principalPaid;

      // Update schedule
      const newTotalPaid = schedule.total_paid + paymentForSchedule;
      const isFullyPaid = newTotalPaid >= (schedule.total_due + schedule.penalty_amount);

      await supabase
        .from('loan_repayment_schedules')
        .update({
          principal_paid: schedule.principal_paid + principalPaid,
          interest_paid: schedule.interest_paid + interestPaid,
          penalty_paid: schedule.penalty_paid + penaltyPaid,
          total_paid: newTotalPaid,
          status: isFullyPaid ? 'paid' : 'partial',
          paid_at: isFullyPaid ? new Date().toISOString() : schedule.paid_at,
        })
        .eq('id', schedule.id);

      remainingAmount -= paymentForSchedule;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('loan_payments')
      .insert({
        payment_reference: paymentRef,
        loan_account_id,
        user_id: user.id,
        amount,
        principal_amount: totalPrincipal,
        interest_amount: totalInterest,
        penalty_amount: totalPenalty,
        payment_method,
        status: 'completed',
        processed_at: new Date().toISOString(),
        notes,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      return new Response(
        JSON.stringify({ error: 'Failed to record payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update loan account
    const newAmountRepaid = loanAccount.amount_repaid + amount;
    const newOutstanding = loanAccount.outstanding_balance - amount;
    const isCompleted = newOutstanding <= 0;

    await supabase
      .from('loan_accounts')
      .update({
        amount_repaid: newAmountRepaid,
        outstanding_balance: Math.max(0, newOutstanding),
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', loan_account_id);

    console.log('Repayment processed successfully:', payment.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        payment,
        message: 'Payment processed successfully',
        remaining_balance: Math.max(0, newOutstanding)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Repayment error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to process repayment', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
