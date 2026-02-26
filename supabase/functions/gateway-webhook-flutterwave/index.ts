import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapFlutterwaveStatus } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Verify Flutterwave hash
    const verifHash = req.headers.get('verif-hash');
    const FLW_HASH = Deno.env.get('FLUTTERWAVE_ENCRYPTION_KEY');
    if (FLW_HASH && verifHash !== FLW_HASH) {
      return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json();
    const eventId = payload.data?.id?.toString() || payload.id?.toString();
    const txRef = payload.data?.tx_ref || payload.tx_ref;

    // Dedupe
    if (eventId) {
      const { data: existing } = await supabase.from('webhook_inbox').select('id').eq('event_id', `flw_${eventId}`).maybeSingle();
      if (existing) return new Response(JSON.stringify({ status: 'already_processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabase.from('webhook_inbox').insert({ event_id: `flw_${eventId}`, provider: 'flutterwave', payload, status: 'processing' });
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

        // ─── Auto-credit account for fund_account charges ───
        if (newStatus === 'successful' && charge.metadata?.fund_account && charge.metadata?.account_id) {
          const accountId = charge.metadata.account_id;
          const userId = charge.metadata.user_id;
          // Credit the user's KOB account
          await supabase.from('account_balances').insert({
            account_id: accountId, balance_type: 'InterimAvailable',
            amount: charge.amount, currency: charge.currency,
            credit_debit_indicator: 'Credit',
            balance_datetime: new Date().toISOString(),
          });
          await supabase.from('transactions').insert({
            account_id: accountId, amount: charge.amount, currency: charge.currency,
            credit_debit_indicator: 'Credit', status: 'Booked',
            booking_date_time: new Date().toISOString(),
            value_date_time: new Date().toISOString(),
            transaction_information: `Account funding completed - ${charge.tx_ref}`,
            transaction_reference: charge.tx_ref, user_id: userId,
          }).then(() => {}).catch(() => {});
          await supabase.from('audit_logs').insert({
            action_type: 'gateway_fund_account_completed', entity_type: 'account', entity_id: accountId,
            performed_by: userId, details: { amount: charge.amount, tx_ref: charge.tx_ref, provider_ref: charge.provider_ref },
          }).then(() => {}).catch(() => {});
        }

        // ─── G4 FIX: Credit merchant wallet on successful charge ───
        if (newStatus === 'successful' && charge.merchant_id) {
          await supabase.rpc('update_merchant_wallet', {
            _merchant_id: charge.merchant_id,
            _currency: charge.currency,
            _pending_delta: charge.net_amount || charge.amount,
            _ledger_delta: charge.net_amount || charge.amount,
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

    // Check for payout events
    const reference = payload.data?.reference;
    if (reference) {
      const { data: payout } = await supabase.from('gateway_payouts').select('*').eq('tx_ref', reference).maybeSingle();
      if (payout) {
        const newStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        const mappedStatus = newStatus === 'successful' ? 'completed' : newStatus;
        await supabase.from('gateway_payouts').update({ status: mappedStatus, provider_raw: payload }).eq('id', payout.id);

        // ─── Handle withdraw-to-bank payout completion/failure ───
        if (payout.metadata?.withdraw_to_bank && payout.metadata?.account_id) {
          const accountId = payout.metadata.account_id;
          const userId = payout.metadata.user_id;

          if (newStatus === 'failed') {
            // Reverse the debit — credit back to user's account
            const totalDebited = payout.amount + (payout.fee_amount || 0);
            await supabase.from('account_balances').insert({
              account_id: accountId, balance_type: 'InterimAvailable',
              amount: totalDebited, currency: payout.currency,
              credit_debit_indicator: 'Credit',
              balance_datetime: new Date().toISOString(),
            });
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

    return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Gateway FLW webhook error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
