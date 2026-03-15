import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const body = await req.json();
    const action = url.searchParams.get('action') || body.action;

    // GENERATE: Merchant generates QR payload
    if (action === 'generate') {
      const { merchant_id, amount, order_id, description } = body;

      if (!merchant_id) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id, business_name')
        .eq('id', merchant_id)
        .eq('user_id', user.id)
        .single();

      if (!merchant) {
        // Check staff
        const { data: staff } = await supabase.from('merchant_pos_staff')
          .select('id').eq('merchant_id', merchant_id).eq('user_id', user.id).eq('status', 'active').single();
        if (!staff) {
          return new Response(JSON.stringify({ error: 'not_authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Get store name
      const { data: storeProfile } = await supabase.from('pos_store_profiles')
        .select('store_name').eq('merchant_id', merchant_id).maybeSingle();

      const qrPayload = {
        type: 'kob_pos_pay',
        merchant_id,
        merchant_name: storeProfile?.store_name || merchant?.business_name || 'Unknown',
        amount: amount ? Number(amount) : 0,
        order_id: order_id || null,
        description: description || null,
        currency: 'XAF',
        generated_at: new Date().toISOString(),
      };

      return new Response(JSON.stringify({ qr_payload: JSON.stringify(qrPayload), decoded: qrPayload }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PAY: Consumer scans QR and pays from wallet
    if (action === 'pay') {
      const idempotencyKey = req.headers.get('Idempotency-Key');
      if (!idempotencyKey) {
        return new Response(JSON.stringify({ error: 'missing_idempotency_key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { merchant_id, amount, order_id } = body;

      if (!merchant_id || !amount) {
        return new Response(JSON.stringify({ error: 'merchant_id and amount required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const total = Number(amount);
      if (total <= 0) {
        return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get consumer's account & balance
      const { data: consumerAccounts } = await supabase.from('accounts')
        .select('id').eq('user_id', user.id).limit(1);
      if (!consumerAccounts?.length) {
        return new Response(JSON.stringify({ error: 'no_wallet' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const consumerAccountId = consumerAccounts[0].id;

      const { data: balance } = await supabase.from('account_balances')
        .select('amount')
        .eq('account_id', consumerAccountId)
        .eq('balance_type', 'ClosingAvailable')
        .maybeSingle();

      const available = balance?.amount || 0;
      if (available < total) {
        return new Response(JSON.stringify({ error: 'insufficient_balance', available, required: total }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If order_id provided, link payment to existing order; otherwise create new order
      let orderId = order_id;
      let orderNumber: string | null = null;

      if (!orderId) {
        // Create a new POS order
        const { data: newOrder, error: orderErr } = await supabase.from('pos_orders').insert({
          merchant_id,
          channel: 'consumer_app',
          status: 'paid',
          currency: 'XAF',
          subtotal: total,
          tax_total: 0,
          discount_total: 0,
          total,
          customer_name: user.user_metadata?.full_name || user.email,
          customer_email: user.email,
          customer_phone: user.phone || null,
          metadata_json: { idempotency_key: idempotencyKey, qr_payment: true, consumer_user_id: user.id },
        }).select().single();
        if (orderErr) throw orderErr;
        orderId = newOrder.id;
        orderNumber = newOrder.order_number;
      } else {
        // Update existing order to paid
        const { data: existingOrder } = await supabase.from('pos_orders')
          .select('order_number').eq('id', orderId).single();
        orderNumber = existingOrder?.order_number || null;
        await supabase.from('pos_orders').update({ status: 'paid' }).eq('id', orderId);
      }

      // Payment record
      await supabase.from('pos_order_payments').insert({
        order_id: orderId,
        merchant_id,
        status: 'succeeded',
        amount: total,
        currency: 'XAF',
        provider: 'wallet',
        method: 'wallet',
        provider_reference: `qr_wallet_${idempotencyKey}`,
      });

      // Debit consumer
      await supabase.from('account_balances').upsert({
        account_id: consumerAccountId,
        balance_type: 'ClosingAvailable',
        amount: available - total,
        currency: 'XAF',
        credit_debit_indicator: 'Debit',
        balance_datetime: new Date().toISOString(),
      }, { onConflict: 'account_id,balance_type' });

      // Credit merchant wallet
      await supabase.rpc('atomic_charge_wallet_credit', {
        _charge_id: orderId, // reuse order id for linking
        _new_status: 'successful',
        _merchant_id: merchant_id,
        _currency: 'XAF',
        _credit_amount: total,
      }).catch(async () => {
        // Fallback: direct upsert
        const { data: mw } = await supabase.from('gateway_merchant_wallets')
          .select('id, available_balance').eq('merchant_id', merchant_id).eq('currency', 'XAF').maybeSingle();
        if (mw) {
          await supabase.from('gateway_merchant_wallets').update({
            available_balance: (mw.available_balance || 0) + total,
            ledger_balance: (mw.available_balance || 0) + total,
          }).eq('id', mw.id);
        } else {
          await supabase.from('gateway_merchant_wallets').insert({
            merchant_id, currency: 'XAF', available_balance: total, pending_balance: 0, ledger_balance: total,
          });
        }
      });

      // Status history
      await supabase.from('pos_order_status_history').insert({
        order_id: orderId, status: 'paid', note: 'QR wallet payment', created_by: user.id,
      });

      // Insert consumer transaction record for ledger history
      try {
        // Get merchant's institution_id for the transaction record
        const { data: merchantData } = await supabase.from('gateway_merchants')
          .select('institution_id, business_name').eq('id', merchant_id).maybeSingle();
        
        const { data: consumerAccount } = await supabase.from('accounts')
          .select('institution_id').eq('id', consumerAccountId).maybeSingle();

        const txInstitutionId = consumerAccount?.institution_id || merchantData?.institution_id;
        
        if (txInstitutionId) {
          await supabase.from('transactions').insert({
            user_id: user.id,
            account_id: consumerAccountId,
            institution_id: txInstitutionId,
            transaction_type: 'Payment',
            amount: total,
            currency: 'XAF',
            credit_debit_indicator: 'Debit',
            status: 'Booked',
            booking_datetime: new Date().toISOString(),
            value_datetime: new Date().toISOString(),
            transaction_information: `QR payment to ${merchantData?.business_name || 'Merchant'}`,
            merchant_details: { transaction_id: orderId, merchant_name: merchantData?.business_name, merchant_id, order_number: orderNumber },
            metadata: { payment_method: 'wallet_qr', order_id: orderId, idempotency_key: idempotencyKey },
          });
        }
      } catch (txErr) {
        console.error('Failed to insert transaction record:', txErr);
        // Non-critical — payment already succeeded
      }

      return new Response(JSON.stringify({
        success: true,
        order_id: orderId,
        order_number: orderNumber,
        amount: total,
        currency: 'XAF',
        payment_method: 'wallet_qr',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', message: 'Use action=generate|pay' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('pos-qr-payment error:', error);
    return new Response(JSON.stringify({ error: 'payment_failed', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
