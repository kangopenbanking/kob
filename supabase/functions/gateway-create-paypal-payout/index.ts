import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPayPalPayout, calculateGatewayFee, mapPayPalStatus } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { merchant_id, amount, currency, recipient_type, receiver, note, tx_ref } = body;

    if (!merchant_id || !amount || !currency || !recipient_type || !receiver || !tx_ref) {
      return new Response(JSON.stringify({
        error: 'invalid_request',
        error_code: 'PAYPAL_001',
        message: 'Missing required fields: merchant_id, amount, currency, recipient_type, receiver, tx_ref',
        error_id: `err_${Date.now()}`,
        timestamp: new Date().toISOString(),
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotency check
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      const { data: existingKey } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('key', idempotencyKey)
        .single();

      if (existingKey) {
        return new Response(JSON.stringify(existingKey.response_body), {
          status: existingKey.response_status || 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
        });
      }
    }

    // Calculate fee
    const { fee, net } = calculateGatewayFee(amount, 'paypal');

    // Create PayPal payout
    const senderBatchId = `KOB-${tx_ref}-${Date.now()}`;
    const result = await createPayPalPayout({
      sender_batch_id: senderBatchId,
      items: [{
        recipient_type: recipient_type as 'EMAIL' | 'PHONE' | 'PAYPAL_ID',
        receiver,
        amount,
        currency,
        note: note || `Payout ${tx_ref}`,
        sender_item_id: tx_ref,
      }],
    });

    // Record payout in gateway_payouts table
    const { data: payout, error: insertError } = await supabase
      .from('gateway_payouts')
      .insert({
        merchant_id,
        amount,
        currency,
        channel: 'paypal',
        status: mapPayPalStatus(result.batch_status),
        provider: 'paypal',
        provider_ref: result.batch_id,
        fee_amount: fee,
        tx_ref,
        beneficiary_name: receiver,
        metadata: { recipient_type, paypal_batch_id: result.batch_id, note },
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const responseBody = {
      id: payout.id,
      batch_id: result.batch_id,
      status: payout.status,
      provider: 'paypal',
      amount,
      currency,
      fee_amount: fee,
      net_amount: net,
      recipient_type,
      receiver,
      tx_ref,
    };

    // Store idempotency
    if (idempotencyKey) {
      await supabase.from('idempotency_keys').insert({
        key: idempotencyKey,
        endpoint: '/v1/gateway/payouts/paypal',
        response_status: 201,
        response_body: responseBody,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'paypal_payout_created',
      entity_type: 'gateway_payout',
      entity_id: payout.id,
      details: { merchant_id, amount, currency, receiver, batch_id: result.batch_id },
    });

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('PayPal payout error:', err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      error_code: 'PAYPAL_500',
      message: err.message || 'Internal server error',
      error_id: `err_${Date.now()}`,
      timestamp: new Date().toISOString(),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
