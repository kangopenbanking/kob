import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFee } from "../_shared/gateway-adapters.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";

import { corsHeaders } from "../_shared/cors.ts";

function calculateNextCharge(interval: string, intervalCount: number): string {
  const now = new Date();
  switch (interval) {
    case 'daily': now.setDate(now.getDate() + intervalCount); break;
    case 'weekly': now.setDate(now.getDate() + 7 * intervalCount); break;
    case 'monthly': now.setMonth(now.getMonth() + intervalCount); break;
    case 'yearly': now.setFullYear(now.getFullYear() + intervalCount); break;
  }
  return now.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Find active subscriptions due for charge
    const { data: dueSubs, error: fetchErr } = await supabase
      .from('gateway_subscriptions')
      .select('*, gateway_payment_plans(*)')
      .eq('status', 'active')
      .lte('next_charge_at', new Date().toISOString())
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!dueSubs || dueSubs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;
    let failed = 0;

    for (const sub of dueSubs) {
      try {
        const plan = sub.gateway_payment_plans;
        if (!plan) continue;

        // Check if duration reached
        if (plan.duration && sub.charges_made >= plan.duration) {
          await supabase.from('gateway_subscriptions').update({ status: 'completed' }).eq('id', sub.id);
          continue;
        }

        const tx_ref = `sub-${sub.id}-${Date.now()}`;
        const channel = 'mobile_money'; // default for subscriptions
        const { fee, net } = await calculateGatewayFee(plan.amount, channel, supabase);
        const provider = 'flutterwave';

        // Create charge
        const { data: charge, error: chargeErr } = await supabase.from('gateway_charges').insert({
          merchant_id: sub.merchant_id, amount: plan.amount, currency: plan.currency,
          channel, status: 'pending', provider, customer_email: sub.customer_email,
          customer_phone: sub.customer_phone, customer_name: sub.customer_name,
          tx_ref, fee_amount: fee, net_amount: net, subscription_id: sub.id,
          metadata: { subscription_id: sub.id, plan_id: plan.id },
        }).select().single();

        if (chargeErr) { failed++; continue; }

        // Call provider
        try {
          const result = await createFlutterwaveCharge({
            amount: plan.amount, currency: plan.currency, channel,
            customer_email: sub.customer_email, customer_phone: sub.customer_phone,
            customer_name: sub.customer_name, tx_ref,
            metadata: { subscription_id: sub.id },
          });

          await supabase.from('gateway_charges').update({
            status: result.status, provider_ref: result.provider_ref, provider_raw: result.provider_raw,
          }).eq('id', charge.id);
        } catch (providerErr) {
          await supabase.from('gateway_charges').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', charge.id);
        }

        // Update subscription
        const nextCharge = calculateNextCharge(plan.interval, plan.interval_count);
        await supabase.from('gateway_subscriptions').update({
          charges_made: sub.charges_made + 1,
          last_charge_id: charge.id,
          next_charge_at: nextCharge,
        }).eq('id', sub.id);

        // Charge event - subscription recurring
        const chargeStatus = charge.status || 'pending';
        const subEventType = chargeStatus === 'failed' ? 'subscription.charge.failed' : 'subscription.charge.successful';
        await supabase.from('gateway_charge_events').insert({
          charge_id: charge.id, event_type: subEventType,
          details: { subscription_id: sub.id, charges_made: sub.charges_made + 1 },
        }).then(() => {}).catch(() => {});

        processed++;
      } catch (subErr) {
        console.error(`Failed to process subscription ${sub.id}:`, subErr);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, failed, total: dueSubs.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
