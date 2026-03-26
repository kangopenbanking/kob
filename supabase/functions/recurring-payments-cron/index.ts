import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

function calculateNextDate(frequency: string, fromDate: string): string {
  const d = new Date(fromDate);
  switch (frequency) {
    case 'Daily': d.setDate(d.getDate() + 1); break;
    case 'Weekly': d.setDate(d.getDate() + 7); break;
    case 'Monthly': d.setMonth(d.getMonth() + 1); break;
    case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find active recurring payments that are due
    const { data: duePayments, error: fetchErr } = await supabase
      .from('recurring_payments')
      .select('*')
      .eq('is_active', true)
      .lte('next_payment_date', new Date().toISOString().split('T')[0])
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!duePayments || duePayments.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No due payments' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const payment of duePayments) {
      try {
        // Check if end_date has passed
        if (payment.end_date && new Date(payment.end_date) < new Date()) {
          await supabase.from('recurring_payments').update({ is_active: false }).eq('id', payment.id);
          continue;
        }

        const paymentRef = `rec-${payment.id}-${Date.now()}`;

        // Log execution
        const { error: execErr } = await supabase.from('recurring_payment_executions').insert({
          recurring_payment_id: payment.id,
          user_id: payment.user_id,
          amount: payment.amount,
          status: 'completed',
          payment_type: payment.category || 'recurring',
          payment_ref: paymentRef,
        });

        if (execErr) {
          console.error(`Failed to log execution for ${payment.id}:`, execErr);
        }

        // Update payment record
        const nextDate = calculateNextDate(payment.frequency, payment.next_payment_date);
        await supabase.from('recurring_payments').update({
          next_payment_date: nextDate,
          last_payment_date: new Date().toISOString().split('T')[0],
          payments_made: (payment.payments_made || 0) + 1,
        }).eq('id', payment.id);

        // Send in-app notification if notify is enabled
        if (payment.notify) {
          await supabase.from('app_notifications').insert({
            user_id: payment.user_id,
            type: 'info',
            title: 'Recurring Payment Processed',
            message: `Your "${payment.name}" payment of ${Number(payment.amount).toLocaleString()} XAF has been processed.`,
            icon: 'payment',
            metadata: {
              recurring_payment_id: payment.id,
              amount: payment.amount,
              payment_ref: paymentRef,
            },
          });
        }

        processed++;
      } catch (subErr) {
        console.error(`Failed to process recurring payment ${payment.id}:`, subErr);

        // Log failed execution
        await supabase.from('recurring_payment_executions').insert({
          recurring_payment_id: payment.id,
          user_id: payment.user_id,
          amount: payment.amount,
          status: 'failed',
          payment_type: payment.category || 'recurring',
          error_message: subErr.message || 'Unknown error',
        }).catch(() => {});

        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, failed, total: duePayments.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] recurring-payments-cron error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
