import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateUserRole, errorResponse } from "../_shared/role-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(corsHeaders, 405, 'method_not_allowed', 'Use POST');
  }

  try {
    // ── Auth: admin only ──
    const roleResult = await validateUserRole(req, ['admin']);
    if (!roleResult.valid) {
      return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
        roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden',
        roleResult.error);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { application_id, approved_amount, approved_tenure_months, interest_rate_override, notes } = body;

    if (!application_id) {
      return errorResponse(corsHeaders, 400, 'LOAN_001', 'application_id is required');
    }

    // ── Fetch application ──
    const { data: app, error: appErr } = await supabase
      .from('loan_applications')
      .select('*, loan_products(*)')
      .eq('id', application_id)
      .single();

    if (appErr || !app) {
      return errorResponse(corsHeaders, 404, 'LOAN_002', 'Loan application not found');
    }

    if (app.status !== 'submitted' && app.status !== 'under_review') {
      return errorResponse(corsHeaders, 422, 'LOAN_003', `Cannot approve application in status: ${app.status}`);
    }

    const principal = approved_amount || app.requested_amount;
    const tenure = approved_tenure_months || app.tenure_months;
    const rate = interest_rate_override || app.loan_products?.interest_rate || 12;

    // ── Calculate loan terms ──
    const monthlyRate = rate / 100 / 12;
    let numberOfPayments = tenure;
    let paymentRate = monthlyRate;

    switch (app.repayment_frequency) {
      case 'daily': numberOfPayments = tenure * 30; paymentRate = rate / 100 / 365; break;
      case 'weekly': numberOfPayments = tenure * 4; paymentRate = rate / 100 / 52; break;
      case 'biweekly': numberOfPayments = tenure * 2; paymentRate = rate / 100 / 26; break;
      case 'quarterly': numberOfPayments = Math.ceil(tenure / 3); paymentRate = rate / 100 / 4; break;
      default: numberOfPayments = tenure; paymentRate = monthlyRate;
    }

    const emi = (principal * paymentRate * Math.pow(1 + paymentRate, numberOfPayments)) /
      (Math.pow(1 + paymentRate, numberOfPayments) - 1);

    const processingFee = principal * 0.01;
    const totalInterest = emi * numberOfPayments - principal;
    const totalPayable = principal + totalInterest + processingFee;

    // ── Generate loan account number ──
    const loanAccountNumber = `LN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // ── Create loan account ──
    const { data: loanAccount, error: laErr } = await supabase
      .from('loan_accounts')
      .insert({
        loan_account_number: loanAccountNumber,
        application_id: application_id,
        user_id: app.user_id,
        loan_product_id: app.loan_product_id,
        principal_amount: principal,
        interest_rate: rate,
        tenure_months: tenure,
        repayment_frequency: app.repayment_frequency,
        total_interest: Math.round(totalInterest * 100) / 100,
        processing_fee: Math.round(processingFee * 100) / 100,
        total_payable: Math.round(totalPayable * 100) / 100,
        outstanding_balance: Math.round(totalPayable * 100) / 100,
        status: 'approved',
      })
      .select()
      .single();

    if (laErr) {
      console.error('Create loan account error:', laErr);
      return errorResponse(corsHeaders, 500, 'LOAN_004', 'Failed to create loan account');
    }

    // ── Generate repayment schedule ──
    const scheduleRows = [];
    let remainingBalance = principal;
    const today = new Date();

    for (let i = 1; i <= numberOfPayments; i++) {
      const interestDue = remainingBalance * paymentRate;
      const principalDue = emi - interestDue;
      remainingBalance -= principalDue;

      // Calculate due date based on frequency
      const dueDate = new Date(today);
      switch (app.repayment_frequency) {
        case 'daily': dueDate.setDate(today.getDate() + i); break;
        case 'weekly': dueDate.setDate(today.getDate() + i * 7); break;
        case 'biweekly': dueDate.setDate(today.getDate() + i * 14); break;
        case 'quarterly': dueDate.setMonth(today.getMonth() + i * 3); break;
        default: dueDate.setMonth(today.getMonth() + i);
      }

      scheduleRows.push({
        loan_id: loanAccount.id,
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        principal_amount: Math.round(principalDue * 100) / 100,
        interest_amount: Math.round(interestDue * 100) / 100,
        fee_amount: i === 1 ? Math.round(processingFee * 100) / 100 : 0,
        total_amount: Math.round((emi + (i === 1 ? processingFee : 0)) * 100) / 100,
        status: 'pending',
      });
    }

    const { error: schedErr } = await supabase.from('loan_schedule').insert(scheduleRows);
    if (schedErr) {
      console.error('Schedule generation error:', schedErr);
      return errorResponse(corsHeaders, 500, 'LOAN_005', 'Failed to generate repayment schedule');
    }

    // ── Update application status ──
    await supabase
      .from('loan_applications')
      .update({ status: 'approved', approved_amount: principal, approved_at: new Date().toISOString() })
      .eq('id', application_id);

    // ── Record loan event ──
    await supabase.from('loan_events').insert({
      loan_id: loanAccount.id,
      event_type: 'approved',
      performed_by: roleResult.userId!,
      metadata: {
        principal, tenure, rate, emi: Math.round(emi * 100) / 100,
        number_of_payments: numberOfPayments, notes,
      },
    });

    // ── Update first/final repayment dates ──
    if (scheduleRows.length > 0) {
      await supabase
        .from('loan_accounts')
        .update({
          first_repayment_date: scheduleRows[0].due_date,
          final_repayment_date: scheduleRows[scheduleRows.length - 1].due_date,
          next_payment_date: scheduleRows[0].due_date,
          next_payment_amount: scheduleRows[0].total_amount,
        })
        .eq('id', loanAccount.id);
    }

    return new Response(JSON.stringify({
      data: {
        loan_account: loanAccount,
        schedule_count: scheduleRows.length,
        emi: Math.round(emi * 100) / 100,
        total_payable: Math.round(totalPayable * 100) / 100,
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('loan-approve error:', err);
    return errorResponse(corsHeaders, 500, 'LOAN_999', 'Internal server error');
  }
});
