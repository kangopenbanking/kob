import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorized');

    const { payment_id } = await req.json();
    if (!payment_id) throw new Error('payment_id required');

    // Get payment and plan details
    const { data: payment, error: payErr } = await supabase
      .from('piggybank_payments')
      .select('*, piggybank_plans(*)')
      .eq('id', payment_id)
      .eq('user_id', user.id)
      .single();

    if (payErr || !payment) throw new Error('Payment not found');
    if (payment.status === 'paid') throw new Error('Already paid');

    const now = new Date();
    const dueDate = new Date(payment.due_date);
    const isLate = now > dueDate;
    const plan = payment.piggybank_plans;
    const isRent = plan.plan_type === 'rent';

    // Determine event type
    let eventType: string;
    if (isRent) {
      eventType = isLate ? 'RENT_PAYMENT_LATE' : 'RENT_PAYMENT_ON_TIME';
    } else {
      eventType = isLate ? 'PIGGYBANK_PAYMENT_LATE' : 'PIGGYBANK_PAYMENT_ON_TIME';
    }

    // Update payment status
    await supabase
      .from('piggybank_payments')
      .update({ status: isLate ? 'late' : 'paid', paid_at: now.toISOString() })
      .eq('id', payment_id);

    // Emit credit event
    // value_numeric: days late for late events (engine uses it for penalty scaling), amount for on-time
    const daysLate = isLate ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const { data: creditEvent } = await supabase
      .from('credit_events')
      .insert({
        user_id: user.id,
        event_type: eventType,
        value_numeric: isLate ? daysLate : payment.amount,
        description: `${isRent ? 'Rent' : 'Piggy bank'} payment ${isLate ? `(late by ${daysLate} days)` : '(on-time)'} - ${plan.plan_name}`,
        event_time: now.toISOString(),
        metadata: {
          payment_id,
          plan_id: plan.id,
          plan_type: plan.plan_type,
          amount: payment.amount,
          days_late: daysLate,
        },
        source: isRent ? 'rent_service' : 'piggybank_service',
      })
      .select('id')
      .single();

    // Link credit event
    if (creditEvent) {
      await supabase
        .from('piggybank_payments')
        .update({ credit_event_id: creditEvent.id })
        .eq('id', payment_id);
    }

    // Trigger score recomputation
    let scoreResult = null;
    try {
      const { data } = await supabase.functions.invoke('credit-score-engine', {
        body: { user_id: user.id },
      });
      scoreResult = data;
    } catch (e) {
      console.error('Score engine error:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      payment_status: isLate ? 'late' : 'paid',
      credit_event_type: eventType,
      score_delta: scoreResult?.delta || 0,
      new_score: scoreResult?.score || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('piggybank-pay error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
