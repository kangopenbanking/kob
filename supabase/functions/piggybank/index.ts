// Consolidated router for piggybank operations: create, pay, overdue-detect
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { corsHeaders } from '../_shared/cors.ts';

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

async function handleCreate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { plan_name, plan_type, target_amount, schedule_frequency, installment_amount, payment_method, start_date, end_date, institution_id, landlord_user_id } = body;
  if (!plan_name || !start_date || !installment_amount) throw new Error('Missing required fields');

  let rent_reference: string | null = null;
  if (plan_type === 'rent') {
    for (let i = 0; i < 10; i++) {
      const candidate = generateRentReference();
      const { data: existing } = await supabase.from('piggybank_plans').select('id').eq('rent_reference', candidate).maybeSingle();
      if (!existing) { rent_reference = candidate; break; }
    }
    if (!rent_reference) throw new Error('Could not generate unique rent reference');
  }

  const { data: plan, error: planErr } = await supabase.from('piggybank_plans').insert({ user_id: user.id, institution_id: institution_id || null, plan_name, plan_type: plan_type || 'savings', target_amount: target_amount || 0, schedule_frequency: schedule_frequency || 'monthly', installment_amount, payment_method: payment_method || null, start_date, end_date: end_date || null, rent_reference, landlord_user_id: landlord_user_id || null }).select().single();
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
  const { payment_id } = body;
  if (!payment_id) throw new Error('payment_id required');

  const { data: payment, error: payErr } = await supabase.from('piggybank_payments').select('*, piggybank_plans(*)').eq('id', payment_id).eq('user_id', user.id).single();
  if (payErr || !payment) throw new Error('Payment not found');
  if (payment.status === 'paid') throw new Error('Already paid');

  const now = new Date(), dueDate = new Date(payment.due_date);
  const isLate = now > dueDate;
  const plan = payment.piggybank_plans;
  const isRent = plan.plan_type === 'rent';
  const eventType = isRent ? (isLate ? 'RENT_PAYMENT_LATE' : 'RENT_PAYMENT_ON_TIME') : (isLate ? 'PIGGYBANK_PAYMENT_LATE' : 'PIGGYBANK_PAYMENT_ON_TIME');

  await supabase.from('piggybank_payments').update({ status: isLate ? 'late' : 'paid', paid_at: now.toISOString() }).eq('id', payment_id);

  const daysLate = isLate ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
  const { data: creditEvent } = await supabase.from('credit_events').insert({ user_id: user.id, event_type: eventType, value_numeric: isLate ? daysLate : payment.amount, description: `${isRent ? 'Rent' : 'Piggy bank'} payment ${isLate ? `(late by ${daysLate} days)` : '(on-time)'} - ${plan.plan_name}`, event_time: now.toISOString(), metadata: { payment_id, plan_id: plan.id, plan_type: plan.plan_type, amount: payment.amount, days_late: daysLate }, source: isRent ? 'rent_service' : 'piggybank_service' }).select('id').single();

  if (creditEvent) await supabase.from('piggybank_payments').update({ credit_event_id: creditEvent.id }).eq('id', payment_id);

  let scoreResult = null;
  try { const { data } = await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: user.id } }); scoreResult = data; } catch (e) { console.error('Score engine error:', e); }

  return new Response(JSON.stringify({ success: true, payment_status: isLate ? 'late' : 'paid', credit_event_type: eventType, score_delta: scoreResult?.delta || 0, new_score: scoreResult?.score || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    processed++;
  }

  return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}