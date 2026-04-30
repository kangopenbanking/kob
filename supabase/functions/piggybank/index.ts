// Consolidated router for piggybank operations: create, pay, auto-fund, overdue-detect
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { recordAuditEvent } from '../_shared/audit-trail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    switch (action) {
      case 'create': return handleCreate(req, body);
      case 'pay': return handlePay(req, body);
      case 'cancel': return handleCancel(req, body);
      case 'delete': return handleDelete(req, body);
      case 'auto-fund': return handleAutoFund(req);
      case 'overdue-detect': return handleOverdueDetect(req);
      default: return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    console.error('piggybank error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabase };
}

function generateRentReference(): string { return `KRENTS${Math.floor(1000 + Math.random() * 9000)}`; }

function generateSchedule(startDate: string, endDate: string | null, frequency: string, installmentAmount: number) {
  const payments: { due_date: string; amount: number }[] = [];
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  let current = new Date(start);
  while (current <= end) {
    payments.push({ due_date: current.toISOString().split('T')[0], amount: installmentAmount });
    if (frequency === 'daily') current.setDate(current.getDate() + 1);
    else if (frequency === 'weekly') current.setDate(current.getDate() + 7);
    else current.setMonth(current.getMonth() + 1);
  }
  return payments;
}

// ─── Atomic wallet debit helper (uses SELECT FOR UPDATE via DB function) ───
async function debitWallet(supabase: any, accountId: string, amount: number, userId: string, description: string): Promise<{ success: boolean; error?: string }> {
  // Atomic debit with row-level locking — prevents double-debit race conditions
  const { data: result, error: rpcErr } = await supabase.rpc('atomic_debit_balance', {
    _account_id: accountId,
    _amount: amount,
    _currency: 'XAF',
  });

  if (rpcErr) {
    const msg = rpcErr.message || 'Failed to debit wallet';
    if (msg.includes('Insufficient funds')) return { success: false, error: msg };
    if (msg.includes('Balance not found')) return { success: false, error: 'Could not retrieve wallet balance' };
    return { success: false, error: msg };
  }

  // Record transaction
  const now = new Date().toISOString();
  await supabase.from('transactions').insert({
    account_id: accountId,
    amount,
    currency: 'XAF',
    credit_debit_indicator: 'Debit',
    status: 'Booked',
    booking_datetime: now,
    value_datetime: now,
    transaction_type: 'savings_deposit',
    transaction_information: description,
    user_id: userId,
    metadata: { source: 'piggybank_auto_fund' },
  });

  return { success: true };
}

async function handleCreate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { plan_name, plan_type, target_amount, schedule_frequency, installment_amount, payment_method, start_date, end_date, institution_id, landlord_user_id, auto_fund_enabled, auto_fund_account_id } = body;
  if (!plan_name || !start_date || !installment_amount) throw new Error('Missing required fields');

  // Validate auto_fund_account_id belongs to user if auto-funding enabled
  if (auto_fund_enabled && auto_fund_account_id) {
    const { data: acct } = await supabase.from('accounts').select('id').eq('id', auto_fund_account_id).eq('user_id', user.id).maybeSingle();
    if (!acct) throw new Error('Invalid wallet account for auto-funding');
  }

  let rent_reference: string | null = null;
  if (plan_type === 'rent') {
    for (let i = 0; i < 10; i++) {
      const candidate = generateRentReference();
      const { data: existing } = await supabase.from('piggybank_plans').select('id').eq('rent_reference', candidate).maybeSingle();
      if (!existing) { rent_reference = candidate; break; }
    }
    if (!rent_reference) throw new Error('Could not generate unique rent reference');
  }

  const { data: plan, error: planErr } = await supabase.from('piggybank_plans').insert({
    user_id: user.id,
    institution_id: institution_id || null,
    plan_name,
    plan_type: plan_type || 'savings',
    target_amount: target_amount || 0,
    schedule_frequency: schedule_frequency || 'monthly',
    installment_amount,
    payment_method: payment_method || null,
    start_date,
    end_date: end_date || null,
    rent_reference,
    landlord_user_id: landlord_user_id || null,
    auto_fund_enabled: auto_fund_enabled || false,
    auto_fund_account_id: (auto_fund_enabled && auto_fund_account_id) ? auto_fund_account_id : null,
  }).select().single();
  if (planErr) throw planErr;

  const schedule = generateSchedule(start_date, end_date, schedule_frequency || 'monthly', installment_amount);
  if (schedule.length > 0) {
    const paymentRows = schedule.map(s => ({ plan_id: plan.id, user_id: user.id, amount: s.amount, due_date: s.due_date, status: 'pending' }));
    await supabase.from('piggybank_payments').insert(paymentRows);
  }

  return new Response(JSON.stringify({ plan, payments_generated: schedule.length, rent_reference, credit_impact_notice: plan_type === 'rent' ? 'Your rent payments will be reported to your credit score.' : 'Your savings plan payments will be tracked for credit scoring.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handlePay(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { payment_id, fund_from_wallet, account_id } = body;
  if (!payment_id) throw new Error('payment_id required');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(payment_id)) {
    return new Response(JSON.stringify({ error: 'invalid_payment_id', message: 'payment_id must be a valid UUID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: payment, error: payErr } = await supabase.from('piggybank_payments').select('*, piggybank_plans(*)').eq('id', payment_id).eq('user_id', user.id).single();
  if (payErr || !payment) {
    return new Response(JSON.stringify({ error: 'payment_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (payment.status === 'paid') throw new Error('Already paid');

  const plan = payment.piggybank_plans;

  // Determine funding source: explicit account_id > plan's auto_fund_account_id
  const fundAccountId = account_id || (plan.auto_fund_enabled ? plan.auto_fund_account_id : null);

  // If funding from wallet, debit first
  if ((fund_from_wallet || plan.auto_fund_enabled) && fundAccountId) {
    const debitResult = await debitWallet(supabase, fundAccountId, payment.amount, user.id, `PiggyBank savings deposit - ${plan.plan_name}`);
    if (!debitResult.success) {
      return new Response(JSON.stringify({ error: 'insufficient_funds', message: debitResult.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const now = new Date(), dueDate = new Date(payment.due_date);
  const isLate = now > dueDate;
  const isRent = plan.plan_type === 'rent';
  const eventType = isRent ? (isLate ? 'RENT_PAYMENT_LATE' : 'RENT_PAYMENT_ON_TIME') : (isLate ? 'PIGGYBANK_PAYMENT_LATE' : 'PIGGYBANK_PAYMENT_ON_TIME');

  await supabase.from('piggybank_payments').update({ status: isLate ? 'late' : 'paid', paid_at: now.toISOString() }).eq('id', payment_id);

  const daysLate = isLate ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
  const { data: creditEvent } = await supabase.from('credit_events').insert({ user_id: user.id, event_type: eventType, value_numeric: isLate ? daysLate : payment.amount, description: `${isRent ? 'Rent' : 'Piggy bank'} payment ${isLate ? `(late by ${daysLate} days)` : '(on-time)'} - ${plan.plan_name}`, event_time: now.toISOString(), metadata: { payment_id, plan_id: plan.id, plan_type: plan.plan_type, amount: payment.amount, days_late: daysLate, funded_from_wallet: !!(fund_from_wallet || plan.auto_fund_enabled) }, source: isRent ? 'rent_service' : 'piggybank_service' }).select('id').single();

  if (creditEvent) await supabase.from('piggybank_payments').update({ credit_event_id: creditEvent.id }).eq('id', payment_id);

  let scoreResult = null;
  try { const { data } = await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: user.id } }); scoreResult = data; } catch (e) { console.error('Score engine error:', e); }

  // ── In-app notification (rent only, to keep noise low) ──
  if (isRent) {
    const delta = scoreResult?.delta ?? 0;
    const sign = delta > 0 ? '+' : '';
    await supabase.from('app_notifications').insert({
      user_id: user.id,
      type: isLate ? 'warning' : 'success',
      title: isLate ? 'Rent payment recorded (late)' : 'Rent payment recorded',
      message: isLate
        ? `Your rent payment for "${plan.plan_name}" was logged ${daysLate} day(s) late. Score impact: ${sign}${delta} pts.`
        : `Your on-time rent payment for "${plan.plan_name}" was logged. Score impact: ${sign}${delta} pts.`,
      icon: 'home',
      metadata: { payment_id, plan_id: plan.id, rent_reference: plan.rent_reference, score_delta: delta, new_score: scoreResult?.score ?? null },
    });
  }

  return new Response(JSON.stringify({ success: true, payment_status: isLate ? 'late' : 'paid', credit_event_type: eventType, score_delta: scoreResult?.delta || 0, new_score: scoreResult?.score || null, wallet_debited: !!(fund_from_wallet || plan.auto_fund_enabled) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Cancel/Stop Plan ───
async function handleCancel(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { plan_id } = body;
  if (!plan_id) throw new Error('plan_id required');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(plan_id)) {
    return new Response(JSON.stringify({ error: 'invalid_plan_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: plan, error: planErr } = await supabase.from('piggybank_plans').select('*').eq('id', plan_id).eq('user_id', user.id).single();
  if (planErr || !plan) {
    return new Response(JSON.stringify({ error: 'plan_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (plan.status === 'cancelled') throw new Error('Plan already cancelled');

  // Cancel the plan
  await supabase.from('piggybank_plans').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', plan_id);

  // Cancel all pending payments
  await supabase.from('piggybank_payments').update({ status: 'cancelled' }).eq('plan_id', plan_id).eq('status', 'pending');

  // Record credit event: cancellation penalty (-5 points)
  const now = new Date().toISOString();
  await supabase.from('credit_events').insert({
    user_id: user.id,
    event_type: 'PIGGYBANK_PLAN_CANCELLED',
    value_numeric: -5,
    description: `Savings plan cancelled - ${plan.plan_name}. Credit score impact: -5 points.`,
    event_time: now,
    metadata: { plan_id, plan_name: plan.plan_name, plan_type: plan.plan_type },
    source: 'piggybank_service',
  });

  // Recompute credit score
  let scoreResult = null;
  try { const { data } = await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: user.id } }); scoreResult = data; } catch (e) { console.error('Score engine error:', e); }

  await recordAuditEvent({
    action_type: 'piggybank_cancelled',
    entity_type: 'piggybank_plan',
    entity_id: plan_id,
    performed_by: user.id,
    details: { plan_name: plan.plan_name, plan_type: plan.plan_type, credit_impact: -5, new_score: scoreResult?.score ?? null },
  });

  return new Response(JSON.stringify({ success: true, credit_impact: -5, new_score: scoreResult?.score || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Delete Personal Plan (no credit impact, removes from history) ───
// Only allowed for personal plans (institution_id IS NULL) that are cancelled or have no paid payments.
async function handleDelete(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { plan_id } = body;
  if (!plan_id) throw new Error('plan_id required');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(plan_id)) {
    return new Response(JSON.stringify({ error: 'invalid_plan_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: plan, error: planErr } = await supabase
    .from('piggybank_plans')
    .select('*, piggybank_payments(id, status)')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single();
  if (planErr || !plan) {
    return new Response(JSON.stringify({ error: 'plan_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Only personal plans can be deleted (no institution attached)
  if (plan.institution_id) {
    return new Response(JSON.stringify({ error: 'bank_plan_not_deletable', message: 'Bank-linked plans cannot be deleted. Cancel it instead.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const hasPaidPayments = (plan.piggybank_payments || []).some((p: any) => p.status === 'paid' || p.status === 'late');
  // If plan has paid payments AND is still active, require cancellation first to preserve credit history
  if (hasPaidPayments && plan.status === 'active') {
    return new Response(JSON.stringify({ error: 'must_cancel_first', message: 'Cancel the plan before deleting it (it has recorded payments).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Delete payments then plan
  await supabase.from('piggybank_payments').delete().eq('plan_id', plan_id);
  await supabase.from('piggybank_plans').delete().eq('id', plan_id).eq('user_id', user.id);

  return new Response(JSON.stringify({ success: true, deleted: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Auto-Fund Cron: processes due payments for auto-funded plans ───
async function handleAutoFund(req: Request) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = new Date().toISOString().split('T')[0];

  // Find pending payments due today or earlier for auto-funded plans
  const { data: duePayments, error } = await supabase
    .from('piggybank_payments')
    .select('*, piggybank_plans!inner(auto_fund_enabled, auto_fund_account_id, plan_name, user_id, plan_type)')
    .eq('status', 'pending')
    .eq('piggybank_plans.auto_fund_enabled', true)
    .lte('due_date', today);

  if (error) throw error;

  let processed = 0, failed = 0;
  for (const payment of (duePayments || [])) {
    const plan = payment.piggybank_plans;
    if (!plan.auto_fund_account_id) continue;

    const debitResult = await debitWallet(supabase, plan.auto_fund_account_id, payment.amount, plan.user_id, `Auto-save deposit - ${plan.plan_name}`);

    if (debitResult.success) {
      const now = new Date();
      const dueDate = new Date(payment.due_date);
      const isLate = now > dueDate;
      const isRent = plan.plan_type === 'rent';
      const eventType = isRent ? (isLate ? 'RENT_PAYMENT_LATE' : 'RENT_PAYMENT_ON_TIME') : (isLate ? 'PIGGYBANK_PAYMENT_LATE' : 'PIGGYBANK_PAYMENT_ON_TIME');

      await supabase.from('piggybank_payments').update({ status: isLate ? 'late' : 'paid', paid_at: now.toISOString() }).eq('id', payment.id);
      await supabase.from('credit_events').insert({ user_id: plan.user_id, event_type: eventType, value_numeric: payment.amount, description: `Auto-funded ${isRent ? 'rent' : 'savings'} payment - ${plan.plan_name}`, event_time: now.toISOString(), metadata: { payment_id: payment.id, auto_funded: true }, source: isRent ? 'rent_service' : 'piggybank_service' });

      try { await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: plan.user_id } }); } catch (e) { console.error('Score recompute failed:', e); }
      processed++;
    } else {
      console.error(`Auto-fund failed for payment ${payment.id}:`, debitResult.error);
      // Send notification about failed auto-debit
      await supabase.from('app_notifications').insert({
        user_id: plan.user_id,
        title: 'Auto-Save Failed',
        message: `Could not auto-debit ${payment.amount} XAF for "${plan.plan_name}". ${debitResult.error}`,
        type: 'piggybank',
        icon: 'alert-circle',
      });
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed, failed, total: (duePayments || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleOverdueDetect(req: Request) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = new Date().toISOString().split('T')[0];

  const { data: overdue, error } = await supabase.from('piggybank_payments').select('*, piggybank_plans(plan_type, plan_name)').eq('status', 'pending').lt('due_date', today);
  if (error) throw error;

  let processed = 0;
  for (const payment of (overdue || [])) {
    const isRent = payment.piggybank_plans?.plan_type === 'rent';
    const eventType = isRent ? 'RENT_PAYMENT_MISSED' : 'PIGGYBANK_PAYMENT_MISSED';
    await supabase.from('piggybank_payments').update({ status: 'missed' }).eq('id', payment.id);
    const { data: creditEvent } = await supabase.from('credit_events').insert({ user_id: payment.user_id, event_type: eventType, value_numeric: payment.amount, description: `Missed ${isRent ? 'rent' : 'piggy bank'} payment - ${payment.piggybank_plans?.plan_name || 'Unknown'}`, event_time: new Date().toISOString() }).select('id').single();
    if (creditEvent) await supabase.from('piggybank_payments').update({ credit_event_id: creditEvent.id }).eq('id', payment.id);
    try { await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: payment.user_id } }); } catch (e) { console.error('Score recompute failed:', e); }

    // In-app notification for missed rent (high-impact event)
    if (isRent) {
      await supabase.from('app_notifications').insert({
        user_id: payment.user_id,
        type: 'warning',
        title: 'Missed rent payment',
        message: `Your rent payment for "${payment.piggybank_plans?.plan_name || 'your plan'}" was not recorded by the due date. Credit impact: -30 pts. Record it now to limit further damage.`,
        icon: 'home',
        metadata: { payment_id: payment.id, plan_id: payment.plan_id, score_impact: -30 },
      });
    }
    processed++;
  }

  return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
