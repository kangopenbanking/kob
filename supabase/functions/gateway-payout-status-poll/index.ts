import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getStripePayoutStatus,
  getFlutterwaveTransferStatus,
  getPayPalPayoutStatus,
} from "../_shared/gateway-adapters.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * Automated Payout Status Poller
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all processing/pending payouts
    const { data: pendingPayouts, error } = await supabase
      .from('gateway_payouts')
      .select('*')
      .in('status', ['processing', 'pending'])
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    if (!pendingPayouts || pendingPayouts.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending payouts', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Payout Poller] Found ${pendingPayouts.length} pending payouts to check`);

    let completed = 0, failed = 0, unchanged = 0;

    for (const payout of pendingPayouts) {
      try {
        let newStatus = '';
        const provider = payout.provider;
        const providerRef = payout.provider_ref;

        if (!providerRef) { unchanged++; continue; }

        // Poll each provider
        if (provider === 'stripe') {
          const result = await getStripePayoutStatus(providerRef);
          if (result.status === 'successful') newStatus = 'completed';
          else if (result.status === 'failed') newStatus = 'failed';
        } else if (provider === 'flutterwave') {
          const result = await getFlutterwaveTransferStatus(providerRef);
          if (result.status === 'successful') newStatus = 'completed';
          else if (result.status === 'failed') newStatus = 'failed';
        } else if (provider === 'paypal') {
          const result = await getPayPalPayoutStatus(providerRef);
          if (result.batch_status === 'SUCCESS') newStatus = 'completed';
          else if (result.batch_status === 'DENIED' || result.batch_status === 'CANCELED') newStatus = 'failed';
        }

        // Auto-fail payouts older than 24 hours still processing
        if (!newStatus) {
          const ageMs = Date.now() - new Date(payout.created_at).getTime();
          if (ageMs > 24 * 60 * 60 * 1000) {
            newStatus = 'failed';
            console.log(`[Payout Poller] Auto-failing stale payout ${payout.id} (age: ${Math.round(ageMs / 3600000)}h)`);
          } else {
            unchanged++;
            continue;
          }
        }

        // Update payout
        await supabase.from('gateway_payouts')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', payout.id);

        // Update transaction
        if (payout.tx_ref) {
          await supabase.from('transactions')
            .update({ status: newStatus === 'completed' ? 'completed' : 'failed' })
            .eq('metadata->>tx_ref', payout.tx_ref)
            .eq('transaction_type', 'withdrawal');
        }

        // Reverse balance on failure
        if (newStatus === 'failed' && payout.metadata?.account_id) {
          const { data: bal } = await supabase
            .from('account_balances')
            .select('*')
            .eq('account_id', payout.metadata.account_id)
            .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
            .order('balance_datetime', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (bal) {
            await supabase.from('account_balances')
              .update({ 
                amount: bal.amount + payout.amount + (payout.fee_amount || 0),
                balance_datetime: new Date().toISOString(),
              })
              .eq('id', bal.id);
          }
        }

        // Audit
        await supabase.from('audit_logs').insert({
          action_type: `payout_auto_${newStatus}`,
          entity_type: 'gateway_payout',
          entity_id: payout.id,
          performed_by: payout.metadata?.user_id || null,
          details: { provider, provider_ref: providerRef, tx_ref: payout.tx_ref, new_status: newStatus, source: 'poller' },
        });

        if (newStatus === 'completed') completed++;
        else if (newStatus === 'failed') failed++;

      } catch (pollErr: any) {
        console.error(`[Payout Poller] Error polling payout ${payout.id}:`, pollErr.message);
        unchanged++;
      }
    }

    const summary = { total: pendingPayouts.length, completed, failed, unchanged };
    console.log('[Payout Poller] Summary:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [Payout Poller] Fatal error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
