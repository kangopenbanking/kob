import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Inbound trace id — echo back on the response so Flutterwave-side
  // logs can be correlated with our internal Pay-by-Bank operations.
  const traceId = req.headers.get('x-trace-id')
    || req.headers.get('traceparent')?.split('-')[1]
    || crypto.randomUUID().replace(/-/g, '');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Flutterwave webhooks are authenticated via a STATIC shared "secret
    // hash" that you set in the FW dashboard and that they send back
    // verbatim on every webhook in the `verif-hash` header. This is
    // distinct from FLUTTERWAVE_SECRET_KEY (used for outbound API auth).
    // See: https://developer.flutterwave.com/docs/webhooks
    const flutterwaveWebhookHash = Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH')
      || Deno.env.get('FLUTTERWAVE_SECRET_HASH')
      || Deno.env.get('FLUTTERWAVE_ENCRYPTION_KEY')
      || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify webhook signature — structured 401 so the dashboard / FW
    // operator can tell missing-header from wrong-secret at a glance.
    const signature = req.headers.get('verif-hash') || '';
    if (!flutterwaveWebhookHash) {
      console.error(`[flw-webhook][trace=${traceId}] FLUTTERWAVE_WEBHOOK_HASH not configured`);
      return new Response(JSON.stringify({
        error: 'webhook_secret_not_configured',
        code: 'WEBHOOK_SECRET_NOT_CONFIGURED',
        message: 'Receiver is not configured to verify Flutterwave webhooks.',
        trace_id: traceId,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Trace-Id': traceId } });
    }
    if (!signature) {
      return new Response(JSON.stringify({
        error: 'missing_signature',
        code: 'SIGNATURE_MISSING',
        message: 'Missing verif-hash header on Flutterwave webhook.',
        trace_id: traceId,
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Trace-Id': traceId } });
    }

    const rawBody = await req.text();
    let payload: any;
    try { payload = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({
        error: 'invalid_json', code: 'INVALID_JSON',
        message: 'Webhook body is not valid JSON.', trace_id: traceId,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Trace-Id': traceId } });
    }

    // Constant-time static compare of the shared secret hash.
    const a = new TextEncoder().encode(signature);
    const b = new TextEncoder().encode(flutterwaveWebhookHash);
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    if (diff !== 0) {
      console.error(`[flw-webhook][trace=${traceId}] signature mismatch`);
      return new Response(JSON.stringify({
        error: 'invalid_signature',
        code: 'SIGNATURE_INVALID',
        message: 'verif-hash did not match the configured Flutterwave webhook hash.',
        trace_id: traceId,
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Trace-Id': traceId } });
    }

    console.log('Flutterwave webhook received:', payload);

    const { event, data } = payload;

    // --- Webhook deduplication via webhook_inbox ---
    const webhookId = data?.id?.toString() || data?.flw_ref || data?.reference || crypto.randomUUID();
    const inboxKey = `flutterwave:${event}:${webhookId}`;

    const { data: existingWebhook } = await supabase
      .from('webhook_inbox')
      .select('id, is_processed')
      .eq('source', 'flutterwave')
      .eq('event_id', inboxKey)
      .single();

    if (existingWebhook?.is_processed) {
      console.log(`Duplicate webhook skipped: ${inboxKey}`);
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record in webhook_inbox
    const { data: inboxRecord } = await supabase.from('webhook_inbox').upsert({
      source: 'flutterwave',
      event_id: inboxKey,
      payload,
      signature,
      is_processed: false,
    }, { onConflict: 'source,event_id' }).select('id').single();
    
    // Handle transfer and charge events
    if (event === 'transfer.completed' || event === 'charge.completed') {
      const transactionRef = data.reference || data.tx_ref;
      const status = data.status?.toLowerCase();
      
      let updateStatus = 'pending';
      if (status === 'successful' || status === 'success') {
        updateStatus = 'completed';
      } else if (status === 'failed') {
        updateStatus = 'failed';
      }

      // Update bank transfer transaction
      const { error: updateError } = await supabase
        .from('bank_transfer_transactions')
        .update({
          status: updateStatus,
          flutterwave_ref: data.id || data.flw_ref,
          metadata: data,
          completed_at: updateStatus === 'completed' ? new Date().toISOString() : null,
          error_message: data.complete_message || data.message,
          updated_at: new Date().toISOString(),
        })
        .eq('transaction_ref', transactionRef);

      if (updateError) {
        console.error('Error updating transaction:', updateError);
        throw new Error('Failed to update transaction');
      }

      // Check if this is a settlement transaction
      const settlementId = data.meta?.settlement_id;
      if (settlementId) {
        console.log('Updating settlement transaction:', settlementId);
        
        const { error: settlementError } = await supabase
          .from('settlement_transactions')
          .update({
            settlement_status: updateStatus,
            flutterwave_transfer_ref: data.id || data.flw_ref,
            completed_at: updateStatus === 'completed' ? new Date().toISOString() : null,
            error_message: updateStatus === 'failed' ? (data.complete_message || data.message) : null,
            metadata: { ...data },
            updated_at: new Date().toISOString(),
          })
          .eq('id', settlementId);

        if (settlementError) {
          console.error('Error updating settlement:', settlementError);
        }
      }

      // Log the webhook event
      await supabase
        .from('security_audit_logs')
        .insert({
          event_type: 'webhook_received',
          event_category: 'payment',
          metadata: {
            webhook_event: event,
            transaction_ref: transactionRef,
            status: updateStatus,
            provider: 'flutterwave',
            settlement_id: settlementId || null,
          },
        });

      console.log(`Transaction ${transactionRef} updated to ${updateStatus}`);

      // ─── Pay-by-Bank reconciliation ──────────────────────────
      // Flutterwave-hosted-checkout Pay-by-Bank intents prefix tx_ref
      // with "pbb_" and carry meta.pay_by_bank_intent_id. When the
      // charge webhook arrives, mark the intent + credit the wallet
      // server-side so the user doesn't need to return through the
      // redirect path. Idempotent — re-firing the webhook is safe.
      if (event === 'charge.completed') {
        const pbbIntentId = data?.meta?.pay_by_bank_intent_id
          || (typeof transactionRef === 'string' && transactionRef.startsWith('pbb_') ? null : null);
        if (pbbIntentId) {
          try {
            const { data: pbb } = await supabase
              .from('pay_by_bank_intents')
              .select('id, status, target_account_id, customer_user_id, amount, currency, metadata')
              .eq('id', pbbIntentId)
              .maybeSingle();
            if (pbb && pbb.status !== 'completed' && pbb.status !== 'failed') {
              if (updateStatus === 'completed' && pbb.target_account_id) {
                const amountNum = Number(pbb.amount);
                const ccy = pbb.currency || 'XAF';
                const { error: cErr } = await supabase.rpc('atomic_credit_balance', {
                  _account_id: pbb.target_account_id,
                  _amount: amountNum,
                  _currency: ccy,
                });
                if (!cErr) {
                  await supabase.from('transactions').insert([{
                    user_id: pbb.customer_user_id,
                    account_id: pbb.target_account_id,
                    amount: amountNum,
                    currency: ccy,
                    credit_debit_indicator: 'Credit',
                    transaction_type: 'pay_by_bank_topup',
                    transaction_information: 'Wallet top-up via Pay-by-Bank (Flutterwave webhook)',
                    booking_datetime: new Date().toISOString(),
                    status: 'Booked',
                    metadata: { intent_id: pbbIntentId, flw_tx_ref: transactionRef, source: 'flutterwave_webhook' },
                  }]).then(() => {}, () => {});
                  // Append confirmed event to intent timeline, preserving any
                  // earlier 'created' / 'awaiting_webhook' entries.
                  const prevMeta = (pbb.metadata || {}) as any;
                  const prevTl = Array.isArray(prevMeta.timeline) ? prevMeta.timeline : [];
                  await supabase.from('pay_by_bank_intents')
                    .update({
                      status: 'completed',
                      metadata: {
                        ...prevMeta,
                        flw_webhook_at: new Date().toISOString(),
                        timeline: [...prevTl, { status: 'confirmed', at: new Date().toISOString(), source: 'flutterwave_webhook', detail: `flw_tx_ref=${transactionRef}` }],
                      },
                    })
                    .eq('id', pbbIntentId);
                  await supabase.rpc('trigger_webhooks', {
                    _event_type: 'pay_by_bank.completed',
                    _event_data: JSON.stringify({ intent_id: pbbIntentId, amount: amountNum, currency: ccy, status: 'completed', source: 'flutterwave_webhook' }),
                  }).catch(() => {});
                }
              } else if (updateStatus === 'failed') {
                const prevMeta = (pbb.metadata || {}) as any;
                const prevTl = Array.isArray(prevMeta.timeline) ? prevMeta.timeline : [];
                await supabase.from('pay_by_bank_intents')
                  .update({
                    status: 'failed',
                    failure_reason: data?.complete_message || data?.message || 'flutterwave_failed',
                    metadata: { ...prevMeta, timeline: [...prevTl, { status: 'failed', at: new Date().toISOString(), source: 'flutterwave_webhook', detail: data?.complete_message || data?.message }] },
                  })
                  .eq('id', pbbIntentId);
                await supabase.rpc('trigger_webhooks', {
                  _event_type: 'pay_by_bank.failed',
                  _event_data: JSON.stringify({ intent_id: pbbIntentId, status: 'failed', source: 'flutterwave_webhook' }),
                }).catch(() => {});
              }

            }
          } catch (e) {
            console.error('[FLUTTERWAVE-WEBHOOK] pay-by-bank reconciliation failed', e);
          }
        }
      }

      // If this is a completed mobile money charge for bank deposit, trigger auto-credit
      if (event === 'charge.completed' && updateStatus === 'completed') {
        const { data: mobileTransaction } = await supabase
          .from('mobile_money_transactions')
          .select('*, destination_account_id, is_bank_deposit')
          .eq('transaction_ref', transactionRef)
          .single();

        if (mobileTransaction?.is_bank_deposit && mobileTransaction.destination_account_id) {
          console.log('Triggering auto-credit for bank deposit:', transactionRef);
          
          // Call the verify function to trigger auto-crediting
          await supabase.functions.invoke('mobile-money-verify', {
            body: { transaction_ref: transactionRef }
          });
        }
      }

    }

    // Mark webhook as processed
    if (inboxRecord?.id) {
      await supabase.from('webhook_inbox').update({
        is_processed: true,
        processed_at: new Date().toISOString()
      }).eq('id', inboxRecord.id);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processed successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Log full details server-side for debugging
    console.error('[FLUTTERWAVE-WEBHOOK] Error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      webhook_type: 'flutterwave_transfer',
      timestamp: new Date().toISOString()
    });
    
    // Return generic error to external webhook caller
    return new Response(JSON.stringify({ 
      received: false,
      message: 'Processing error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
