import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getStripePayoutStatus,
  getFlutterwaveTransferStatus,
  getPayPalPayoutStatus,
} from "../_shared/gateway-adapters.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins, notifyUser } from "../_shared/admin-notify.ts";
import { sendManagedEmail } from "../_shared/send-managed-email.ts";

/**
 * Automated Payout Status Poller — runs on cron schedule
 * Polls all pending/processing payouts and updates statuses.
 * Sends admin + user alerts on completion or failure.
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
      .in('status', ['processing', 'pending', 'submitted'])
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

        const isConsumerWithdrawal = payout.metadata?.withdrawal === true;
        const isMerchantPayout = !!payout.merchant_id;
        const payoutUserId = payout.metadata?.user_id || payout.metadata?.requested_by;
        const fmtAmount = new Intl.NumberFormat('fr-CM').format(payout.amount);

        // Reverse balance on failure
        if (newStatus === 'failed') {
          if (isConsumerWithdrawal && payout.metadata?.account_id) {
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

          if (isMerchantPayout) {
            // Restore merchant wallet balance
            await supabase.rpc('update_merchant_wallet', {
              _merchant_id: payout.merchant_id,
              _currency: payout.currency,
              _available_delta: payout.amount,
              _pending_delta: -payout.amount,
            });
          }

          // ═══ ALERT: Admin notification on payout failure ═══
          notifyAdmins(supabase, {
            event_type: 'payout_auto_failed',
            entity_type: 'gateway_payout',
            entity_id: payout.id,
            title: '⚠️ Payout Failed — Manual Review Required',
            message: `${payout.currency} ${fmtAmount} payout to ${payout.beneficiary_name || 'N/A'} (${payout.channel}) via ${provider} has FAILED. Balance restored. Ref: ${payout.tx_ref}`,
            metadata: { payout_id: payout.id, amount: payout.amount, channel: payout.channel, provider, tx_ref: payout.tx_ref, is_consumer: isConsumerWithdrawal },
          });

          // ═══ ALERT: Notify user on failure ═══
          if (payoutUserId) {
            notifyUser(supabase, {
              user_id: payoutUserId,
              type: 'warning',
              title: 'Withdrawal Failed',
              message: `Your ${payout.currency} ${fmtAmount} withdrawal to ${payout.beneficiary_name || payout.channel} could not be delivered. Your balance has been restored.`,
              icon: 'cash_out',
              metadata: { payout_id: payout.id, tx_ref: payout.tx_ref },
            });

            sendManagedEmail(supabase, {
              email_key: isConsumerWithdrawal ? 'consumer_withdrawal_failed' : 'merchant_withdrawal_failed',
              recipient_user_id: payoutUserId,
              variables: {
                currency: payout.currency, amount: fmtAmount,
                destination: payout.beneficiary_name || payout.channel, tx_ref: payout.tx_ref,
                error: 'Provider failed to complete the transfer',
              },
            });
          }
        }

        // ═══ ALERT: On successful completion ═══
        if (newStatus === 'completed') {
          // Settle merchant wallet (move from pending to settled)
          if (isMerchantPayout) {
            await supabase.rpc('update_merchant_wallet', {
              _merchant_id: payout.merchant_id,
              _currency: payout.currency,
              _pending_delta: -payout.amount,
              _ledger_delta: 0,
            });
          }

          // Admin notification
          notifyAdmins(supabase, {
            event_type: 'payout_auto_completed',
            entity_type: 'gateway_payout',
            entity_id: payout.id,
            title: '✅ Payout Completed',
            message: `${payout.currency} ${fmtAmount} payout to ${payout.beneficiary_name || 'N/A'} (${payout.channel}) completed successfully. Ref: ${payout.tx_ref}`,
            metadata: { payout_id: payout.id, amount: payout.amount, channel: payout.channel, provider },
          });

          // User notification
          if (payoutUserId) {
            notifyUser(supabase, {
              user_id: payoutUserId,
              type: 'success',
              title: 'Withdrawal Complete',
              message: `Your ${payout.currency} ${fmtAmount} has been delivered to ${payout.beneficiary_name || payout.channel}.`,
              icon: 'cash_out',
              metadata: { payout_id: payout.id, tx_ref: payout.tx_ref },
            });

            sendManagedEmail(supabase, {
              email_key: isConsumerWithdrawal ? 'consumer_withdrawal_completed' : 'merchant_withdrawal_completed',
              recipient_user_id: payoutUserId,
              variables: {
                currency: payout.currency, amount: fmtAmount,
                destination: payout.beneficiary_name || payout.channel, tx_ref: payout.tx_ref,
              },
            });
          }
        }

        // Audit
        await supabase.from('audit_logs').insert({
          action_type: `payout_auto_${newStatus}`,
          entity_type: 'gateway_payout',
          entity_id: payout.id,
          performed_by: payoutUserId || null,
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