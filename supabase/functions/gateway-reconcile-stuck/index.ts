import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    console.log('Starting stuck transaction reconciliation...');

    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const results = { charges: 0, payouts: 0, refunds: 0, errors: [] as string[] };

    // 1. Reconcile stuck charges (pending > 30 min)
    const { data: stuckCharges } = await supabase
      .from('gateway_charges')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('created_at', stuckThreshold)
      .limit(100);

    for (const charge of stuckCharges || []) {
      try {
        if (charge.provider === 'flutterwave' && charge.provider_ref) {
          const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
          if (FLW_SECRET) {
            const res = await fetch(`https://api.flutterwave.com/v3/transactions/${charge.provider_ref}/verify`, {
              headers: { Authorization: `Bearer ${FLW_SECRET}` },
            });
            const data = await res.json();
            const status = data.data?.status === 'successful' ? 'successful' : data.data?.status === 'failed' ? 'failed' : null;
            if (status) {
              await supabase.from('gateway_charges').update({ status, provider_raw: data }).eq('id', charge.id);
              results.charges++;
            }
          }
        } else if (charge.provider === 'stripe' && charge.provider_ref) {
          const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
          if (STRIPE_SECRET) {
            const res = await fetch(`https://api.stripe.com/v1/payment_intents/${charge.provider_ref}`, {
              headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
            });
            const data = await res.json();
            const statusMap: Record<string, string> = { succeeded: 'successful', canceled: 'failed' };
            const status = statusMap[data.status];
            if (status) {
              await supabase.from('gateway_charges').update({ status, provider_raw: data }).eq('id', charge.id);
              results.charges++;
            }
          }
        }
      } catch (err) {
        results.errors.push(`charge_${charge.id}: ${err.message}`);
      }
    }

    // 2. Reconcile stuck payouts
    const { data: stuckPayouts } = await supabase
      .from('gateway_payouts')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('created_at', stuckThreshold)
      .limit(100);

    for (const payout of stuckPayouts || []) {
      try {
        if (payout.provider === 'flutterwave' && payout.provider_ref) {
          const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
          if (FLW_SECRET) {
            const res = await fetch(`https://api.flutterwave.com/v3/transfers/${payout.provider_ref}`, {
              headers: { Authorization: `Bearer ${FLW_SECRET}` },
            });
            const data = await res.json();
            const status = data.data?.status === 'SUCCESSFUL' ? 'successful' : data.data?.status === 'FAILED' ? 'failed' : null;
            if (status) {
              await supabase.from('gateway_payouts').update({ status, provider_raw: data }).eq('id', payout.id);
              results.payouts++;
            }
          }
        }
      } catch (err) {
        results.errors.push(`payout_${payout.id}: ${err.message}`);
      }
    }

    // 3. Reconcile stuck refunds
    const { data: stuckRefunds } = await supabase
      .from('gateway_refunds')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', stuckThreshold)
      .limit(100);

    for (const refund of stuckRefunds || []) {
      try {
        if (refund.provider === 'stripe' && refund.provider_ref) {
          const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
          if (STRIPE_SECRET) {
            const res = await fetch(`https://api.stripe.com/v1/refunds/${refund.provider_ref}`, {
              headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
            });
            const data = await res.json();
            if (data.status === 'succeeded') {
              await supabase.from('gateway_refunds').update({ status: 'successful', provider_raw: data }).eq('id', refund.id);
              results.refunds++;
            } else if (data.status === 'failed') {
              await supabase.from('gateway_refunds').update({ status: 'failed', provider_raw: data }).eq('id', refund.id);
              results.refunds++;
            }
          }
        }
      } catch (err) {
        results.errors.push(`refund_${refund.id}: ${err.message}`);
      }
    }

    // 4. Mark very old stuck transactions (> 24h) as failed
    const veryOldThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    await supabase.from('gateway_charges').update({ status: 'failed', failure_reason: 'Timed out after 24 hours' })
      .in('status', ['pending', 'processing']).lt('created_at', veryOldThreshold);
    
    await supabase.from('gateway_payouts').update({ status: 'failed', failure_reason: 'Timed out after 24 hours' })
      .in('status', ['pending', 'processing']).lt('created_at', veryOldThreshold);

    console.log('Stuck transaction reconciliation completed:', results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Reconciliation error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
