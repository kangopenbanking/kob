import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapFlutterwaveStatus } from "../_shared/gateway-adapters.ts";
import { creditFundingIntent } from "../_shared/funding-scope-creditor.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let dedupeKeyForCleanup: string | null = null;
  try {


    // ─── Webhook Rate Limiting: 100 req/min for Flutterwave ───
    const { data: allowed } = await supabase.rpc('check_webhook_rate_limit', { _provider: 'flutterwave', _max_requests: 100, _window_minutes: 1 });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify Flutterwave hash — MANDATORY (C7 + F1 fix)
    // Flutterwave v3 uses a shared-secret header 'verif-hash' (no body HMAC).
    // We compare in constant time to prevent timing-side-channel leakage of the secret.
    const verifHash = req.headers.get('verif-hash');
    const FLW_HASH = Deno.env.get('FLUTTERWAVE_ENCRYPTION_KEY');
    if (!FLW_HASH) {
      console.error('FLUTTERWAVE_ENCRYPTION_KEY not configured — rejecting webhook');
      return new Response(JSON.stringify({ error: 'webhook_not_configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const timingSafeEqual = (a: string, b: string): boolean => {
      const ea = new TextEncoder().encode(a);
      const eb = new TextEncoder().encode(b);
      if (ea.length !== eb.length) return false;
      let diff = 0;
      for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
      return diff === 0;
    };
    if (!verifHash || !timingSafeEqual(verifHash, FLW_HASH)) {
      console.error('Invalid or missing Flutterwave verif-hash — rejecting');
      return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json();
    const eventId = payload.data?.id?.toString() || payload.id?.toString();
    const txRef = payload.data?.tx_ref || payload.tx_ref;

    // Dedupe (atomic via UNIQUE(source,event_id) → ignore-on-conflict)
    const dedupeKey = eventId ? `flw_${eventId}` : null;
    if (dedupeKey) {
      const { data: existing } = await supabase.from('webhook_inbox').select('id,status').eq('event_id', dedupeKey).maybeSingle();
      if (existing && existing.status === 'processed') {
        return new Response(JSON.stringify({ status: 'already_processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!existing) {
        await supabase.from('webhook_inbox').insert({ event_id: dedupeKey, provider: 'flutterwave', event_type: payload.event || 'charge.completed', payload, status: 'processing' });
      } else {
        // prior attempt failed — reset to processing for retry
        await supabase.from('webhook_inbox').update({ status: 'processing', payload }).eq('event_id', dedupeKey);
      }
      dedupeKeyForCleanup = dedupeKey;
    }


    // Find matching charge
    if (txRef) {
      const { data: charge } = await supabase.from('gateway_charges').select('*').eq('tx_ref', txRef).maybeSingle();
      if (charge) {
        const newStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        await supabase.from('gateway_charges').update({
          status: newStatus,
          provider_ref: payload.data?.flw_ref || charge.provider_ref,
          provider_raw: payload,
        }).eq('id', charge.id);

        // ─── Auto-credit account for fund_account charges (F5: atomic row-locked RPC) ───
        if (newStatus === 'successful' && charge.metadata?.fund_account && charge.metadata?.account_id) {
          const { error: creditErr } = await supabase.rpc('atomic_flw_account_credit', {
            _account_id: charge.metadata.account_id,
            _user_id: charge.metadata.user_id ?? null,
            _amount: charge.amount,
            _currency: charge.currency,
            _tx_ref: charge.tx_ref,
            _institution_id: null,
            _provider_ref: charge.provider_ref ?? null,
            _source: 'flutterwave_fund_account',
            _metadata: { charge_id: charge.id },
          });
          if (creditErr) console.error('atomic_flw_account_credit (fund_account) failed', creditErr);
        }

        // ─── ATOMIC: Credit merchant wallet on successful charge (C5 fix: skip fund_account) ───
        if (newStatus === 'successful' && charge.merchant_id && !charge.metadata?.fund_account) {
          await supabase.rpc('atomic_charge_wallet_credit', {
            _charge_id: charge.id,
            _new_status: newStatus,
            _provider_raw: payload,
            _merchant_id: charge.merchant_id,
            _currency: charge.currency,
            _credit_amount: charge.net_amount || charge.amount,
          });
        }

        // Trigger outbound merchant webhook (only for merchant charges)
        if ((newStatus === 'successful' || newStatus === 'failed') && charge.merchant_id) {
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: charge.merchant_id,
            event_type: newStatus === 'successful' ? 'charge.successful' : 'charge.failed',
            payload: { charge_id: charge.id, status: newStatus, amount: charge.amount, currency: charge.currency, tx_ref: charge.tx_ref },
            status: 'pending',
            next_retry_at: new Date().toISOString(),
          });
        }
      }
    }

    // ─── Funding Intents: finalize on Flutterwave webhook ───
    if (txRef) {
      const { data: fundingIntent } = await supabase.from('funding_intents').select('*').eq('reference', txRef).in('status', ['pending_provider', 'pending_customer_action', 'pending_verification', 'created']).maybeSingle();
      if (fundingIntent) {
        const fiStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        await supabase.from('funding_intents').update({
          status: fiStatus === 'successful' ? 'succeeded' : fiStatus,
          provider_payload: payload,
          failure_message: fiStatus === 'failed' ? `Flutterwave: ${payload.data?.status}` : null,
        }).eq('id', fundingIntent.id);

        await supabase.from('funding_events').insert({
          funding_intent_id: fundingIntent.id, event_type: `webhook_${fiStatus}`,
          payload: { provider: 'flutterwave', flw_ref: eventId },
        });

        if (fiStatus === 'successful') {
          await creditFundingIntent(supabase, fundingIntent);
        }
      }
    }

    // Check for payout events
    const reference = payload.data?.reference;
    if (reference) {
      const { data: payout } = await supabase.from('gateway_payouts').select('*').eq('tx_ref', reference).maybeSingle();
      if (payout) {
        const newStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        const mappedStatus = newStatus === 'successful' ? 'completed' : newStatus;
        await supabase.from('gateway_payouts').update({ status: mappedStatus, provider_raw: payload }).eq('id', payout.id);

        // ─── Handle withdraw-to-bank payout completion/failure (FIXED: upsert ClosingAvailable) ───
        if (payout.metadata?.withdraw_to_bank && payout.metadata?.account_id) {
          const accountId = payout.metadata.account_id;
          const userId = payout.metadata.user_id;

          if (newStatus === 'failed') {
            // Reverse the debit — credit back to user's ClosingAvailable balance
            const totalDebited = payout.amount + (payout.fee_amount || 0);

            const { data: existingBal } = await supabase
              .from('account_balances')
              .select('id, amount')
              .eq('account_id', accountId)
              .eq('balance_type', 'ClosingAvailable')
              .eq('credit_debit_indicator', 'Credit')
              .maybeSingle();

            if (existingBal) {
              await supabase.from('account_balances').update({
                amount: existingBal.amount + totalDebited,
                balance_datetime: new Date().toISOString(),
              }).eq('id', existingBal.id);
            } else {
              await supabase.from('account_balances').insert({
                account_id: accountId, balance_type: 'ClosingAvailable',
                amount: totalDebited, currency: payout.currency,
                credit_debit_indicator: 'Credit',
                balance_datetime: new Date().toISOString(),
              });
            }

            await supabase.from('audit_logs').insert({
              action_type: 'gateway_withdraw_failed_reversed', entity_type: 'account', entity_id: accountId,
              performed_by: userId, details: { amount: payout.amount, tx_ref: payout.tx_ref },
            }).then(() => {}).catch(() => {});
          } else if (newStatus === 'successful') {
            // Mark debit transaction as completed
            await supabase.from('transactions')
              .update({ status: 'Booked' })
              .eq('transaction_reference', payout.tx_ref);
            await supabase.from('audit_logs').insert({
              action_type: 'gateway_withdraw_completed', entity_type: 'account', entity_id: accountId,
              performed_by: userId, details: { amount: payout.amount, tx_ref: payout.tx_ref },
            }).then(() => {}).catch(() => {});
          }
        }

        // Outbound merchant webhook (only for merchant payouts)
        if ((newStatus === 'successful' || newStatus === 'failed') && payout.merchant_id) {
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: payout.merchant_id,
            event_type: newStatus === 'successful' ? 'payout.completed' : 'payout.failed',
            payload: { payout_id: payout.id, status: mappedStatus, amount: payout.amount },
            status: 'pending',
            next_retry_at: new Date().toISOString(),
          });
        }
      }

      // ─── Remittance status sync: finalize remittance on payout completion ───
      // Guard: payout may be null if reference didn't match a known payout row.
      if (payout && payout.metadata?.remittance_id) {
        const newStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        const remittanceId = payout.metadata.remittance_id;
        const remittanceStatus = newStatus === 'successful' ? 'credited' : newStatus === 'failed' ? 'failed' : null;
        if (remittanceStatus) {
          await supabase.from('remittances').update({
            status: remittanceStatus,
            ...(remittanceStatus === 'credited' ? { completed_at: new Date().toISOString() } : {}),
            ...(remittanceStatus === 'failed' ? { cancellation_reason: `Flutterwave payout ${payload.data?.status}`, cancelled_at: new Date().toISOString() } : {}),
          }).eq('id', remittanceId);

          await supabase.from('remittance_events').insert({
            remittance_id: remittanceId,
            event_type: remittanceStatus === 'credited' ? 'transfer_delivered' : 'transfer_failed',
            payload_raw: JSON.stringify({ provider: 'flutterwave', payout_id: payout.id, tx_ref: payout.tx_ref, status: newStatus }),
            signature_valid: true,
          });

          // Notify sender
          const { data: remData } = await supabase.from('remittances').select('sender_user_id, receiver_name, amount_out, currency_out').eq('id', remittanceId).maybeSingle();
          if (remData?.sender_user_id) {
            await supabase.from('app_notifications').insert({
              user_id: remData.sender_user_id,
              type: remittanceStatus === 'credited' ? 'success' : 'warning',
              title: remittanceStatus === 'credited' ? 'Transfer Delivered!' : 'Transfer Failed',
              message: remittanceStatus === 'credited'
                ? `Your transfer of ${remData.amount_out?.toLocaleString()} ${remData.currency_out} to ${remData.receiver_name} has been delivered.`
                : `Your transfer to ${remData.receiver_name} failed. Please contact support.`,
              icon: remittanceStatus === 'credited' ? 'check-circle' : 'x-circle',
              metadata: { remittance_id: remittanceId },
            });
          }
        }
      }
    }

    // Handle virtual account credit events
    const eventType = payload.event || payload.data?.event;
    if (eventType === 'virtualaccount.credit' || payload.data?.virtual_account_number) {
      const vaNumber = payload.data?.virtual_account_number;
      if (vaNumber) {
        const { data: va } = await supabase.from('gateway_virtual_accounts').select('*').eq('account_number', vaNumber).eq('status', 'active').maybeSingle();
        if (va) {
          const creditAmount = payload.data?.amount || 0;
          const creditCurrency = payload.data?.currency || va.currency;
          // Auto-create a charge for the virtual account credit
          await supabase.from('gateway_charges').insert({
            merchant_id: va.merchant_id, amount: creditAmount, currency: creditCurrency,
            channel: 'bank_transfer', status: 'successful', provider: 'flutterwave',
            provider_ref: payload.data?.flw_ref || eventId,
            customer_email: va.email, tx_ref: `va-credit-${eventId}-${Date.now()}`,
            fee_amount: 0, net_amount: creditAmount, metadata: { source: 'virtual_account', va_id: va.id },
            provider_raw: payload,
          });
          // Update wallet
          await supabase.rpc('update_merchant_wallet', {
            _merchant_id: va.merchant_id, _currency: creditCurrency,
            _pending_delta: creditAmount, _ledger_delta: creditAmount,
          });
          // Outbound webhook
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: va.merchant_id, event_type: 'virtualaccount.credit',
            payload: { va_id: va.id, amount: creditAmount, currency: creditCurrency },
            status: 'pending', next_retry_at: new Date().toISOString(),
          });
        }
      }
    }

    // Mark webhook as processed
    if (dedupeKey) {
      await supabase.from('webhook_inbox').update({ status: 'processed' }).eq('event_id', dedupeKey);
    }

    return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    // Reset inbox row to 'failed' so Flutterwave's retry can re-process (don't leave it stuck on 'processing')
    if (dedupeKeyForCleanup) {
      try {
        await supabase.from('webhook_inbox').update({ status: 'failed', error_message: String((err as Error)?.message ?? err).slice(0, 500) }).eq('event_id', dedupeKeyForCleanup);
      } catch (_) { /* swallow */ }
    }
    return safeErrorResponse(err, corsHeaders, 'gateway-webhook-flutterwave');
  }
});

