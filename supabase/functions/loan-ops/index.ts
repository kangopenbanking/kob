// Consolidated router for loan operations: apply, approve, calculate, disburse, repay, overdue-detect
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { validateUserRole, errorResponse } from '../_shared/role-middleware.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendManagedEmail, getUserName, emailManagers } from '../_shared/send-managed-email.ts';
import { notifyAdmins } from '../_shared/admin-notify.ts';
import { recordAuditEvent } from '../_shared/audit-trail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // For cron actions, check cron auth first
    let bodyText: string;
    let body: any;
    
    // Try to parse body
    try {
      bodyText = await req.text();
      body = JSON.parse(bodyText);
    } catch {
      bodyText = '{}';
      body = {};
    }

    const action = body.action;
    if (!action) {
      return new Response(JSON.stringify({ error: 'action parameter required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'apply': return handleApply(req, body);
      case 'approve': return handleApprove(req, body);
      case 'calculate': return handleCalculate(body);
      case 'disburse': return handleDisburse(req, body, bodyText);
      case 'repay': return handleRepay(req, body, bodyText);
      case 'overdue-detect': return handleOverdueDetect(req);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error('loan-ops error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── APPLY ──
async function handleApply(req: Request, body: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    loan_product_id, requested_amount, tenure_months, purpose,
    repayment_frequency = 'monthly', employment_details, guarantors,
    collateral_details, supporting_documents, submit = false, institution_id,
  } = body;

  // Fetch credit score for auto-decision
  let creditScore = null;
  let autoDecision = null;
  let recommendedAmount = null;

  try {
    const { data: scoreData } = await supabase.functions.invoke('credit-score', {
      body: { action: 'fetch', user_id: user.id, include_report: false }
    });
    if (scoreData?.score) {
      creditScore = scoreData.score;
      if (creditScore >= 720) { autoDecision = 'pre_approved'; recommendedAmount = requested_amount; }
      else if (creditScore >= 650) { autoDecision = 'under_review'; recommendedAmount = requested_amount * 0.7; }
      else if (creditScore >= 580) { autoDecision = 'conditional'; recommendedAmount = requested_amount * 0.5; }
      else { autoDecision = 'requires_review'; recommendedAmount = requested_amount * 0.3; }
    }
  } catch (scoreError) { console.error('Error fetching credit score:', scoreError); }

  const { data: product, error: productError } = await supabase
    .from('loan_products').select('*').eq('id', loan_product_id).eq('is_active', true).single();

  if (productError || !product) {
    return new Response(JSON.stringify({ error: 'Invalid or inactive loan product' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (requested_amount < product.min_amount || requested_amount > product.max_amount) {
    return new Response(JSON.stringify({ error: `Amount must be between ${product.min_amount} and ${product.max_amount}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (tenure_months < product.min_tenure_months || tenure_months > product.max_tenure_months) {
    return new Response(JSON.stringify({ error: `Tenure must be between ${product.min_tenure_months} and ${product.max_tenure_months} months` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const applicationNumber = `LA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const { data: application, error: applicationError } = await supabase
    .from('loan_applications')
    .insert({
      application_number: applicationNumber, user_id: user.id, loan_product_id,
      requested_amount, tenure_months, purpose, repayment_frequency,
      employment_details, guarantors, collateral_details, supporting_documents,
      status: submit ? 'submitted' : 'draft',
      submitted_at: submit ? new Date().toISOString() : null,
      credit_score: creditScore, auto_decision: autoDecision,
      recommended_amount: recommendedAmount, institution_id: institution_id || null,
    })
    .select().single();

  if (applicationError) {
    return new Response(JSON.stringify({ error: 'Failed to create loan application', details: applicationError }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ✉️ Email customer: loan application received (only when submitted)
  if (submit && application) {
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const customerName = await getUserName(serviceClient, user.id);
    sendManagedEmail(serviceClient, {
      email_key: 'loan_application_received',
      recipient_user_id: user.id,
      institution_id: institution_id || undefined,
      variables: { customer_name: customerName, application_number: applicationNumber, currency: 'XAF', requested_amount: new Intl.NumberFormat('fr-CM').format(requested_amount), tenure_months, purpose: purpose || 'Not specified' },
    });

    // ✉️ Email management: new loan application alert
    if (institution_id) {
      emailManagers(serviceClient, {
        institution_id,
        role_type: 'branch_manager',
        email_key: 'loan_application_alert',
        variables: { application_number: applicationNumber, customer_name: customerName, currency: 'XAF', requested_amount: new Intl.NumberFormat('fr-CM').format(requested_amount), tenure_months, credit_score: creditScore || 'N/A', auto_decision: autoDecision || 'Manual review' },
      });
    }
  }

  // Audit trail + admin notification (additive, non-blocking)
  if (submit && application) {
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await recordAuditEvent({
      action_type: 'loan_application_submitted',
      entity_type: 'loan_application',
      entity_id: application.id,
      performed_by: user.id,
      details: { application_number: applicationNumber, requested_amount, tenure_months, institution_id, credit_score: creditScore, auto_decision: autoDecision },
    });
    notifyAdmins(adminClient, {
      event_type: 'loan_application_submitted',
      entity_type: 'loan_application',
      entity_id: application.id,
      title: 'New loan application',
      message: `Application ${applicationNumber} for ${new Intl.NumberFormat('fr-CM').format(requested_amount)} XAF awaiting review.`,
      institution_id,
      metadata: { application_number: applicationNumber, requested_amount, credit_score: creditScore, auto_decision: autoDecision },
    });
  }

  return new Response(JSON.stringify({ success: true, application, message: submit ? 'Application submitted successfully' : 'Application saved as draft' }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── APPROVE ──
async function handleApprove(req: Request, body: any) {
  const roleResult = await validateUserRole(req, ['admin']);
  if (!roleResult.valid) {
    return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
      roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden', roleResult.error);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { application_id, approved_amount, approved_tenure_months, interest_rate_override, notes } = body;

  if (!application_id) return errorResponse(corsHeaders, 400, 'LOAN_001', 'application_id is required');

  const { data: app, error: appErr } = await supabase.from('loan_applications').select('*, loan_products(*)').eq('id', application_id).single();
  if (appErr || !app) return errorResponse(corsHeaders, 404, 'LOAN_002', 'Loan application not found');
  if (app.status !== 'submitted' && app.status !== 'under_review') return errorResponse(corsHeaders, 422, 'LOAN_003', `Cannot approve application in status: ${app.status}`);

  const principal = approved_amount || app.requested_amount;
  const tenure = approved_tenure_months || app.tenure_months;
  const rate = interest_rate_override || app.loan_products?.interest_rate || 12;

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

  const emi = (principal * paymentRate * Math.pow(1 + paymentRate, numberOfPayments)) / (Math.pow(1 + paymentRate, numberOfPayments) - 1);
  // Fee resolution: unified admin-managed fee_structures.
  // Admin edits to `loan_processing_fee` in /admin/fee-management apply here live.
  const { resolveFee } = await import('../_shared/resolve-fee.ts');
  const _procQuote = await resolveFee(supabase, {
    transaction_type: 'loan_processing_fee',
    amount: principal,
    fallback: { percentage_rate: 1.0, fixed_amount: 0 }, // matches legacy 1%
  });
  const processingFee = _procQuote.final_fee;
  const totalInterest = emi * numberOfPayments - principal;
  const totalPayable = principal + totalInterest + processingFee;
  const loanAccountNumber = `LN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const { data: loanAccount, error: laErr } = await supabase.from('loan_accounts').insert({
    loan_account_number: loanAccountNumber, application_id, user_id: app.user_id,
    loan_product_id: app.loan_product_id, principal_amount: principal, interest_rate: rate,
    tenure_months: tenure, repayment_frequency: app.repayment_frequency,
    total_interest: Math.round(totalInterest * 100) / 100,
    processing_fee: Math.round(processingFee * 100) / 100,
    total_payable: Math.round(totalPayable * 100) / 100,
    outstanding_balance: Math.round(totalPayable * 100) / 100, status: 'approved',
  }).select().single();

  if (laErr) return errorResponse(corsHeaders, 500, 'LOAN_004', 'Failed to create loan account');

  const scheduleRows: any[] = [];
  let remainingBalance = principal;
  const today = new Date();

  for (let i = 1; i <= numberOfPayments; i++) {
    const interestDue = remainingBalance * paymentRate;
    const principalDue = emi - interestDue;
    remainingBalance -= principalDue;
    const dueDate = new Date(today);
    switch (app.repayment_frequency) {
      case 'daily': dueDate.setDate(today.getDate() + i); break;
      case 'weekly': dueDate.setDate(today.getDate() + i * 7); break;
      case 'biweekly': dueDate.setDate(today.getDate() + i * 14); break;
      case 'quarterly': dueDate.setMonth(today.getMonth() + i * 3); break;
      default: dueDate.setMonth(today.getMonth() + i);
    }
    scheduleRows.push({
      loan_id: loanAccount.id, installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      principal_amount: Math.round(principalDue * 100) / 100,
      interest_amount: Math.round(interestDue * 100) / 100,
      fee_amount: i === 1 ? Math.round(processingFee * 100) / 100 : 0,
      total_amount: Math.round((emi + (i === 1 ? processingFee : 0)) * 100) / 100,
      status: 'pending',
    });
  }

  const { error: schedErr } = await supabase.from('loan_schedule').insert(scheduleRows);
  if (schedErr) return errorResponse(corsHeaders, 500, 'LOAN_005', 'Failed to generate repayment schedule');

  await supabase.from('loan_applications').update({ status: 'approved', approved_amount: principal, approved_at: new Date().toISOString() }).eq('id', application_id);
  await supabase.from('loan_events').insert({ loan_id: loanAccount.id, event_type: 'approved', performed_by: roleResult.userId!, metadata: { principal, tenure, rate, emi: Math.round(emi * 100) / 100, number_of_payments: numberOfPayments, notes } });

  if (scheduleRows.length > 0) {
    await supabase.from('loan_accounts').update({
      first_repayment_date: scheduleRows[0].due_date,
      final_repayment_date: scheduleRows[scheduleRows.length - 1].due_date,
      next_payment_date: scheduleRows[0].due_date,
      next_payment_amount: scheduleRows[0].total_amount,
    }).eq('id', loanAccount.id);
  }

  // ✉️ Email customer: loan approved
  const approvedCustomerName = await getUserName(supabase, app.user_id);
  sendManagedEmail(supabase, {
    email_key: 'loan_approved',
    recipient_user_id: app.user_id,
    institution_id: app.institution_id || undefined,
    variables: { customer_name: approvedCustomerName, currency: 'XAF', approved_amount: new Intl.NumberFormat('fr-CM').format(principal), interest_rate: rate, monthly_payment: new Intl.NumberFormat('fr-CM').format(Math.round(emi * 100) / 100), tenure_months: tenure, loan_account_number: loanAccountNumber },
  });

  await recordAuditEvent({
    action_type: 'loan_approved',
    entity_type: 'loan_account',
    entity_id: loanAccount.id,
    performed_by: roleResult.userId,
    details: { application_id, principal, tenure, rate, emi: Math.round(emi * 100) / 100, notes },
  });

  return new Response(JSON.stringify({ data: { loan_account: loanAccount, schedule_count: scheduleRows.length, emi: Math.round(emi * 100) / 100, total_payable: Math.round(totalPayable * 100) / 100 } }), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── CALCULATE ──
async function handleCalculate(body: any) {
  const { principal, interest_rate, tenure_months, repayment_frequency = 'monthly' } = body;
  const processingFee = principal * 0.01;
  const monthlyRate = interest_rate / 100 / 12;
  let numberOfPayments = tenure_months;
  let paymentFrequencyRate = monthlyRate;

  switch (repayment_frequency) {
    case 'daily': numberOfPayments = tenure_months * 30; paymentFrequencyRate = interest_rate / 100 / 365; break;
    case 'weekly': numberOfPayments = tenure_months * 4; paymentFrequencyRate = interest_rate / 100 / 52; break;
    case 'biweekly': numberOfPayments = tenure_months * 2; paymentFrequencyRate = interest_rate / 100 / 26; break;
    case 'quarterly': numberOfPayments = Math.ceil(tenure_months / 3); paymentFrequencyRate = interest_rate / 100 / 4; break;
    default: numberOfPayments = tenure_months; paymentFrequencyRate = monthlyRate;
  }

  const emi = (principal * paymentFrequencyRate * Math.pow(1 + paymentFrequencyRate, numberOfPayments)) / (Math.pow(1 + paymentFrequencyRate, numberOfPayments) - 1);
  const totalPayable = emi * numberOfPayments + processingFee;
  const totalInterest = totalPayable - principal - processingFee;

  const schedule: any[] = [];
  let remainingBalance = principal;
  for (let i = 1; i <= numberOfPayments; i++) {
    const interestDue = remainingBalance * paymentFrequencyRate;
    const principalDue = emi - interestDue;
    remainingBalance -= principalDue;
    schedule.push({ installment_number: i, principal_due: Math.round(principalDue * 100) / 100, interest_due: Math.round(interestDue * 100) / 100, total_due: Math.round(emi * 100) / 100, outstanding_balance: Math.max(0, Math.round(remainingBalance * 100) / 100) });
  }

  return new Response(JSON.stringify({ success: true, principal, interest_rate, tenure_months, repayment_frequency, processing_fee: Math.round(processingFee * 100) / 100, emi: Math.round(emi * 100) / 100, total_interest: Math.round(totalInterest * 100) / 100, total_payable: Math.round(totalPayable * 100) / 100, number_of_payments: numberOfPayments, schedule }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── DISBURSE ──
async function handleDisburse(req: Request, body: any, bodyText: string) {
  const roleResult = await validateUserRole(req, ['admin']);
  if (!roleResult.valid) {
    return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
      roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden', roleResult.error);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey) return errorResponse(corsHeaders, 400, 'missing_idempotency_key', 'Idempotency-Key header is required');

  const payloadHash = await hashPayload(bodyText);
  const { data: existing } = await supabase.from('idempotency_keys').select('*').eq('idempotency_key', idempotencyKey).eq('client_id', roleResult.userId!).eq('endpoint', 'loan-disburse').maybeSingle();

  if (existing) {
    if (existing.payload_hash !== payloadHash) return new Response(JSON.stringify({ error: 'idempotency_conflict' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(existing.response_body), { status: existing.response_status || 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
  }

  const { loan_account_id, disbursement_method, notes } = body;
  if (!loan_account_id) return errorResponse(corsHeaders, 400, 'LOAN_011', 'loan_account_id is required');

  const { data: loan, error: loanErr } = await supabase.from('loan_accounts').select('*').eq('id', loan_account_id).single();
  if (loanErr || !loan) return errorResponse(corsHeaders, 404, 'LOAN_012', 'Loan account not found');
  if (loan.status !== 'approved') return errorResponse(corsHeaders, 422, 'LOAN_013', `Cannot disburse loan in status: ${loan.status}`);

  const loanReceivableId = await ensureLedgerAccount(supabase, '1200', 'Loan Receivable', 'asset');
  const cashAccountId = await ensureLedgerAccount(supabase, '1000', 'Cash', 'asset');

  const { data: journalEntry, error: jeErr } = await supabase.from('journal_entries').insert({ entry_number: `JE-DISBURSE-${Date.now()}`, entry_date: new Date().toISOString().split('T')[0], description: `Loan disbursement: ${loan.loan_account_number}`, reference_type: 'loan_disbursement', reference_id: loan_account_id, is_reversed: false }).select().single();
  if (jeErr) throw jeErr;

  await supabase.from('journal_lines').insert([
    { journal_entry_id: journalEntry.id, ledger_account_id: loanReceivableId, debit: Number(loan.principal_amount), credit: 0 },
    { journal_entry_id: journalEntry.id, ledger_account_id: cashAccountId, debit: 0, credit: Number(loan.principal_amount) },
  ]);

  await updateLedgerBalance(supabase, loanReceivableId, 'asset', Number(loan.principal_amount), 0);
  await updateLedgerBalance(supabase, cashAccountId, 'asset', 0, Number(loan.principal_amount));

  const now = new Date().toISOString();
  await supabase.from('loan_accounts').update({ status: 'disbursed', amount_disbursed: loan.principal_amount, disbursed_at: now }).eq('id', loan_account_id);
  await supabase.from('loan_events').insert({ loan_id: loan_account_id, event_type: 'disbursed', performed_by: roleResult.userId!, metadata: { amount: Number(loan.principal_amount), journal_entry_id: journalEntry.id, disbursement_method: disbursement_method || 'bank_transfer', notes } });

  // ✉️ Email customer: loan disbursed
  const disbCustomerName = await getUserName(supabase, loan.user_id);
  const { data: disbSchedule } = await supabase.from('loan_schedule').select('due_date, total_amount').eq('loan_id', loan_account_id).order('installment_number', { ascending: true }).limit(1).maybeSingle();
  sendManagedEmail(supabase, {
    email_key: 'loan_disbursement_confirmed',
    recipient_user_id: loan.user_id,
    institution_id: loan.institution_id || undefined,
    variables: { customer_name: disbCustomerName, currency: 'XAF', amount: new Intl.NumberFormat('fr-CM').format(Number(loan.principal_amount)), loan_account_number: loan.loan_account_number, first_due_date: disbSchedule?.due_date || 'TBD', monthly_payment: disbSchedule ? new Intl.NumberFormat('fr-CM').format(Number(disbSchedule.total_amount)) : 'N/A' },
  });

  const responseBody = { data: { loan_account_id, status: 'disbursed', amount_disbursed: Number(loan.principal_amount), journal_entry_id: journalEntry.id, disbursed_at: now } };
  await supabase.from('idempotency_keys').insert({ idempotency_key: idempotencyKey, client_id: roleResult.userId!, endpoint: 'loan-disburse', payload_hash: payloadHash, response_status: 200, response_body: responseBody, expires_at: new Date(Date.now() + 86400000).toISOString() });

  await recordAuditEvent({
    action_type: 'loan_disbursed',
    entity_type: 'loan_account',
    entity_id: loan_account_id,
    performed_by: roleResult.userId,
    details: { amount: Number(loan.principal_amount), journal_entry_id: journalEntry.id, disbursement_method: disbursement_method || 'bank_transfer', notes },
  });

  return new Response(JSON.stringify(responseBody), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey } });
}

// ── REPAY (simplified - key logic preserved) ──
async function handleRepay(req: Request, body: any, bodyText: string) {
  const roleResult = await validateUserRole(req);
  if (!roleResult.valid) return errorResponse(corsHeaders, 401, 'unauthorized', roleResult.error);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey) return errorResponse(corsHeaders, 400, 'missing_idempotency_key', 'Idempotency-Key header is required');

  const payloadHash = await hashPayload(bodyText);
  const { data: existing } = await supabase.from('idempotency_keys').select('*').eq('idempotency_key', idempotencyKey).eq('client_id', roleResult.userId!).eq('endpoint', 'loan-repay').maybeSingle();

  if (existing) {
    if (existing.payload_hash !== payloadHash) return new Response(JSON.stringify({ error: 'idempotency_conflict' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(existing.response_body), { status: existing.response_status || 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
  }

  const { loan_account_id, amount, payment_method, notes } = body;
  if (!loan_account_id || !amount || amount <= 0) return errorResponse(corsHeaders, 400, 'LOAN_021', 'loan_account_id and positive amount are required');

  const { data: loan, error: loanErr } = await supabase.from('loan_accounts').select('*').eq('id', loan_account_id).eq('user_id', roleResult.userId!).single();
  if (loanErr || !loan) return errorResponse(corsHeaders, 404, 'LOAN_022', 'Loan account not found');
  if (!['active', 'disbursed'].includes(loan.status)) return errorResponse(corsHeaders, 422, 'LOAN_023', `Cannot repay loan in status: ${loan.status}`);
  if (amount > Number(loan.outstanding_balance)) return errorResponse(corsHeaders, 422, 'LOAN_024', 'Payment exceeds outstanding balance');

  const { data: schedules } = await supabase.from('loan_schedule').select('*').eq('loan_id', loan_account_id).in('status', ['pending', 'partial']).order('installment_number', { ascending: true });

  let remainingAmount = amount;
  let totalPrincipal = 0, totalInterest = 0, totalFees = 0;

  for (const schedule of (schedules || [])) {
    if (remainingAmount <= 0) break;
    const outstanding = Number(schedule.total_amount) - Number(schedule.paid_amount);
    const paymentForSchedule = Math.min(remainingAmount, outstanding);
    const feeRemaining = Number(schedule.fee_amount) - (Number(schedule.paid_amount) > Number(schedule.principal_amount) + Number(schedule.interest_amount) ? Number(schedule.paid_amount) - Number(schedule.principal_amount) - Number(schedule.interest_amount) : 0);
    const feePaid = Math.min(paymentForSchedule, Math.max(0, feeRemaining));
    const interestPaid = Math.min(paymentForSchedule - feePaid, Number(schedule.interest_amount));
    const principalPaid = paymentForSchedule - feePaid - interestPaid;
    totalFees += feePaid; totalInterest += interestPaid; totalPrincipal += principalPaid;
    const newPaid = Number(schedule.paid_amount) + paymentForSchedule;
    const isFullyPaid = newPaid >= Number(schedule.total_amount) - 0.01;
    await supabase.from('loan_schedule').update({ paid_amount: Math.round(newPaid * 100) / 100, status: isFullyPaid ? 'paid' : 'partial', paid_at: isFullyPaid ? new Date().toISOString() : null }).eq('id', schedule.id);
    remainingAmount -= paymentForSchedule;
  }

  const cashId = await ensureLedgerAccount(supabase, '1000', 'Cash', 'asset');
  const loanReceivableId = await ensureLedgerAccount(supabase, '1200', 'Loan Receivable', 'asset');
  const interestRevenueId = await ensureLedgerAccount(supabase, '4100', 'Interest Revenue', 'revenue');

  const { data: journalEntry, error: jeErr } = await supabase.from('journal_entries').insert({ entry_number: `JE-REPAY-${Date.now()}`, entry_date: new Date().toISOString().split('T')[0], description: `Loan repayment: ${loan.loan_account_number}`, reference_type: 'loan_repayment', reference_id: loan_account_id, is_reversed: false }).select().single();
  if (jeErr) throw jeErr;

  const journalLines: any[] = [{ journal_entry_id: journalEntry.id, ledger_account_id: cashId, debit: amount, credit: 0 }];
  if (totalPrincipal > 0) journalLines.push({ journal_entry_id: journalEntry.id, ledger_account_id: loanReceivableId, debit: 0, credit: Math.round(totalPrincipal * 100) / 100 });
  if (totalInterest + totalFees > 0) journalLines.push({ journal_entry_id: journalEntry.id, ledger_account_id: interestRevenueId, debit: 0, credit: Math.round((totalInterest + totalFees) * 100) / 100 });
  await supabase.from('journal_lines').insert(journalLines);

  await updateLedgerBalance(supabase, cashId, 'asset', amount, 0);
  if (totalPrincipal > 0) await updateLedgerBalance(supabase, loanReceivableId, 'asset', 0, totalPrincipal);
  if (totalInterest + totalFees > 0) await updateLedgerBalance(supabase, interestRevenueId, 'revenue', 0, totalInterest + totalFees);

  const paymentRef = `LP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  await supabase.from('loan_repayments').insert({ loan_id: loan_account_id, amount, principal_paid: Math.round(totalPrincipal * 100) / 100, interest_paid: Math.round(totalInterest * 100) / 100, fees_paid: Math.round(totalFees * 100) / 100, payment_method: payment_method || 'bank_transfer', payment_reference: paymentRef, journal_entry_id: journalEntry.id });

  const newRepaid = Number(loan.amount_repaid) + amount;
  const newOutstanding = Number(loan.outstanding_balance) - amount;
  const isCompleted = newOutstanding <= 0.01;

  const { data: nextSched } = await supabase.from('loan_schedule').select('due_date, total_amount, paid_amount').eq('loan_id', loan_account_id).eq('status', 'pending').order('installment_number', { ascending: true }).limit(1).maybeSingle();
  await supabase.from('loan_accounts').update({ amount_repaid: Math.round(newRepaid * 100) / 100, outstanding_balance: Math.max(0, Math.round(newOutstanding * 100) / 100), status: isCompleted ? 'completed' : 'active', completed_at: isCompleted ? new Date().toISOString() : null, next_payment_date: nextSched?.due_date || null, next_payment_amount: nextSched ? Number(nextSched.total_amount) - Number(nextSched.paid_amount) : null }).eq('id', loan_account_id);
  await supabase.from('loan_events').insert({ loan_id: loan_account_id, event_type: 'repayment', performed_by: roleResult.userId!, metadata: { amount, principal_paid: totalPrincipal, interest_paid: totalInterest, fees_paid: totalFees, payment_reference: paymentRef, journal_entry_id: journalEntry.id, notes } });

  // Credit events (non-blocking)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    await fetch(`${supabaseUrl}/functions/v1/credit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` }, body: JSON.stringify({ action: 'engine', user_id: roleResult.userId! }) });
  } catch (e) { console.error('Credit score recompute failed:', e); }

  // Promise to Pay settlement (non-blocking)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    await fetch(`${supabaseUrl}/functions/v1/ptp-settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ mode: 'match', loan_account_id, amount, paid_at: new Date().toISOString() }),
    });
  } catch (e) { console.error('PTP settle failed:', e); }

  // ✉️ Email customer: loan repayment confirmed
  const repayCustomerName = await getUserName(supabase, loan.user_id);
  sendManagedEmail(supabase, {
    email_key: 'loan_repayment_confirmed',
    recipient_user_id: loan.user_id,
    variables: { customer_name: repayCustomerName, currency: 'XAF', amount: new Intl.NumberFormat('fr-CM').format(amount), payment_reference: paymentRef, principal_paid: new Intl.NumberFormat('fr-CM').format(Math.round(totalPrincipal * 100) / 100), interest_paid: new Intl.NumberFormat('fr-CM').format(Math.round(totalInterest * 100) / 100), remaining_balance: new Intl.NumberFormat('fr-CM').format(Math.max(0, Math.round(newOutstanding * 100) / 100)), loan_status: isCompleted ? 'Fully Repaid' : 'Active' },
  });

  // ✉️ If loan completed, send congratulations
  if (isCompleted) {
    sendManagedEmail(supabase, {
      email_key: 'loan_completed',
      recipient_user_id: loan.user_id,
      variables: { customer_name: repayCustomerName, loan_account_number: loan.loan_account_number, currency: 'XAF', total_paid: new Intl.NumberFormat('fr-CM').format(Math.round(newRepaid * 100) / 100) },
    });
  }

  const responseBody = { data: { payment_reference: paymentRef, amount, principal_paid: Math.round(totalPrincipal * 100) / 100, interest_paid: Math.round(totalInterest * 100) / 100, fees_paid: Math.round(totalFees * 100) / 100, remaining_balance: Math.max(0, Math.round(newOutstanding * 100) / 100), loan_status: isCompleted ? 'completed' : 'active', journal_entry_id: journalEntry.id } };
  await supabase.from('idempotency_keys').insert({ idempotency_key: idempotencyKey, client_id: roleResult.userId!, endpoint: 'loan-repay', payload_hash: payloadHash, response_status: 200, response_body: responseBody, expires_at: new Date(Date.now() + 86400000).toISOString() });

  return new Response(JSON.stringify(responseBody), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey! } });
}

// ── OVERDUE DETECT ──
async function handleOverdueDetect(req: Request) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const graceDays = 3;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - graceDays);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const { data: overdueItems, error } = await supabase.from('loan_schedule').select('id, loan_id, due_date, total_amount, paid_amount, installment_number').in('status', ['pending', 'partial']).eq('missed_event_created', false).lt('due_date', cutoff);
  if (error) throw error;

  const affectedUsers = new Set<string>();
  let processed = 0;

  for (const item of (overdueItems || [])) {
    const { data: loan } = await supabase.from('loan_accounts').select('user_id, institution_id, loan_account_number').eq('id', item.loan_id).single();
    if (!loan) continue;
    const daysLate = Math.floor((Date.now() - new Date(item.due_date).getTime()) / 86400000);
    const amountDue = Number(item.total_amount) - Number(item.paid_amount);
    await supabase.from('credit_events').insert({ user_id: loan.user_id, institution_id: loan.institution_id, event_type: 'LOAN_INSTALLMENT_MISSED', event_time: new Date().toISOString(), value_numeric: daysLate, metadata: { loan_id: item.loan_id, schedule_item_id: item.id, installment_number: item.installment_number, due_date: item.due_date, amount_due: amountDue }, source: 'overdue_job' });
    await supabase.from('loan_schedule').update({ missed_event_created: true, status: 'overdue' }).eq('id', item.id);

    // ✉️ Email customer: loan overdue notice
    const overdueCustomerName = await getUserName(supabase, loan.user_id);
    sendManagedEmail(supabase, {
      email_key: 'loan_overdue_alert',
      recipient_user_id: loan.user_id,
      institution_id: loan.institution_id || undefined,
      variables: { customer_name: overdueCustomerName, days_overdue: daysLate, currency: 'XAF', amount_due: new Intl.NumberFormat('fr-CM').format(amountDue), due_date: item.due_date, loan_account_number: loan.loan_account_number || item.loan_id.slice(0, 8), installment_number: item.installment_number },
    });

    affectedUsers.add(loan.user_id);
    processed++;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  for (const userId of affectedUsers) {
    try { await fetch(`${supabaseUrl}/functions/v1/credit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` }, body: JSON.stringify({ action: 'engine', user_id: userId }) }); } catch (e) { console.error(`Score recompute failed for ${userId}:`, e); }
  }

  // ✉️ Email management: overdue batch alert
  if (processed > 0) {
    // Find all affected institutions
    const institutionIds = new Set<string>();
    for (const item of (overdueItems || [])) {
      const { data: loan } = await supabase.from('loan_accounts').select('institution_id').eq('id', item.loan_id).maybeSingle();
      if (loan?.institution_id) institutionIds.add(loan.institution_id);
    }
    for (const instId of institutionIds) {
      emailManagers(supabase, {
        institution_id: instId,
        role_type: 'branch_manager',
        email_key: 'loan_overdue_management_alert',
        variables: { overdue_count: processed, users_affected: affectedUsers.size },
      });
    }
  }

  return new Response(JSON.stringify({ success: true, processed, users_affected: affectedUsers.size }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Helpers ──
async function ensureLedgerAccount(supabase: any, code: string, name: string, type: string): Promise<string> {
  const { data } = await supabase.from('ledger_accounts').select('id').eq('account_code', code).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await supabase.from('ledger_accounts').insert({ account_code: code, account_name: name, account_type: type, currency: 'XAF', balance: 0 }).select().single();
  if (error) throw error;
  return created.id;
}

async function updateLedgerBalance(supabase: any, accountId: string, accountType: string, debit: number, credit: number) {
  const { data: account } = await supabase.from('ledger_accounts').select('balance').eq('id', accountId).single();
  if (!account) return;
  let newBalance: number;
  if (['asset', 'expense'].includes(accountType)) { newBalance = (account.balance || 0) + debit - credit; } else { newBalance = (account.balance || 0) + credit - debit; }
  await supabase.from('ledger_accounts').update({ balance: newBalance }).eq('id', accountId);
}

async function hashPayload(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}