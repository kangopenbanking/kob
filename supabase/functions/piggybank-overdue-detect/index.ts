import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    // Find overdue piggybank payments
    const { data: overdue, error } = await supabase
      .from('piggybank_payments')
      .select('*, piggybank_plans(plan_type, plan_name)')
      .eq('status', 'pending')
      .lt('due_date', today);

    if (error) throw error;

    let processed = 0;
    for (const payment of (overdue || [])) {
      const isRent = payment.piggybank_plans?.plan_type === 'rent';
      const eventType = isRent ? 'RENT_PAYMENT_MISSED' : 'PIGGYBANK_PAYMENT_MISSED';

      // Mark as missed
      await supabase
        .from('piggybank_payments')
        .update({ status: 'missed' })
        .eq('id', payment.id);

      // Emit credit event
      const { data: creditEvent } = await supabase
        .from('credit_events')
        .insert({
          user_id: payment.user_id,
          event_type: eventType,
          value_numeric: payment.amount,
          description: `Missed ${isRent ? 'rent' : 'piggy bank'} payment - ${payment.piggybank_plans?.plan_name || 'Unknown'}`,
          event_time: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (creditEvent) {
        await supabase
          .from('piggybank_payments')
          .update({ credit_event_id: creditEvent.id })
          .eq('id', payment.id);
      }

      // Recompute score
      try {
        await supabase.functions.invoke('credit-score-engine', {
          body: { user_id: payment.user_id },
        });
      } catch (e) { console.error('Score recompute failed:', e); }

      processed++;
    }

    console.log(`piggybank-overdue-detect: processed ${processed} overdue payments`);
    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
