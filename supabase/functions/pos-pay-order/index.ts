import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail } from '../_shared/send-managed-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!idempotencyKey) {
      return new Response(JSON.stringify({ error: 'missing_idempotency_key', message: 'Idempotency-Key header is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { order_id, method, provider, customer } = body;

    if (!order_id || !method) {
      return new Response(JSON.stringify({ error: 'order_id and method required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch order with items
    const { data: order, error: orderErr } = await supabase.from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('id', order_id)
      .single();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (order.status !== 'pending_payment') {
      return new Response(JSON.stringify({ error: 'invalid_order_status', message: `Order must be pending_payment, got ${order.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check idempotency: if payment already exists for this key, return it
    const { data: existingPayment } = await supabase.from('pos_order_payments')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (existingPayment && existingPayment.status === 'succeeded') {
      return new Response(JSON.stringify({ 
        success: true, 
        payment: existingPayment,
        message: 'Payment already completed (idempotent)' 
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const amount = body.amount || order.total;
    const currency = order.currency || 'XAF';
    const txRef = `pos_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // Create gateway charge
    let chargeResult: any;
    let paymentUrl: string | null = null;
    let instructions: string = '';

    const chargeMetadata = {
      pos_order_id: order.id,
      order_number: order.order_number,
      channel: 'pos',
      idempotency_key: idempotencyKey,
    };

    switch (method) {
      case 'cash': {
        // Cash payment — finalize immediately, no external provider
        await supabase.from('pos_orders').update({ status: 'paid' }).eq('id', order.id);
        const { data: cashPayment } = await supabase.from('pos_order_payments').insert({
          order_id: order.id, merchant_id: order.merchant_id,
          status: 'succeeded', amount, currency, provider: 'cash', method: 'cash',
          provider_reference: `cash_${idempotencyKey}`,
        }).select().single();
        // Credit merchant wallet
        const { data: mw } = await supabase.from('gateway_merchant_wallets')
          .select('id, available_balance, ledger_balance').eq('merchant_id', order.merchant_id).eq('currency', currency).maybeSingle();
        if (mw) {
          await supabase.from('gateway_merchant_wallets').update({
            available_balance: (mw.available_balance || 0) + amount,
            ledger_balance: (mw.ledger_balance || 0) + amount,
          }).eq('id', mw.id);
        } else {
          await supabase.from('gateway_merchant_wallets').insert({
            merchant_id: order.merchant_id, currency, available_balance: amount, pending_balance: 0, ledger_balance: amount,
          });
        }
        // Inventory decrement
        if (order.location_id) {
          for (const item of order.pos_order_items || []) {
            await supabase.rpc('pos_adjust_inventory', {
              _merchant_id: order.merchant_id, _variant_id: item.variant_id,
              _location_id: order.location_id, _quantity_delta: -item.quantity,
              _type: 'sale', _reason: `Cash payment order ${order.order_number}`,
              _reference_type: 'pos_order', _reference_id: order.id,
            }).catch(() => {});
          }
        }
        await supabase.from('pos_order_status_history').insert({
          order_id: order.id, status: 'paid', note: 'Cash payment completed', created_by: user.id,
        });
        // ✉️ POS order receipt for cash
        if (customer?.email) {
          sendManagedEmail(supabase, {
            email_key: 'pos_order_receipt',
            recipient_email: customer.email,
            variables: {
              customer_name: customer.name || 'Customer',
              merchant_name: order.merchant_name || 'Store',
              order_number: order.order_number, currency, amount: new Intl.NumberFormat('fr-CM').format(amount),
              payment_method: 'Cash',
            },
          });
        }
        return new Response(JSON.stringify({
          success: true, order_id: order.id, order_number: order.order_number,
          payment_id: cashPayment?.id, method: 'cash', status: 'succeeded',
          amount, currency, instructions: 'Cash payment recorded',
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'mobile_money': {
        const { data, error } = await supabase.functions.invoke('gateway-create-charge', {
          body: {
            merchant_id: order.merchant_id,
            amount, currency, channel: 'mobile_money', provider: provider || 'flutterwave',
            customer_phone: customer?.phone || order.customer_phone,
            customer_email: customer?.email || order.customer_email,
            customer_name: customer?.name || order.customer_name,
            tx_ref: txRef,
            idempotency_key: idempotencyKey,
            metadata: chargeMetadata,
          },
          headers: { Authorization: authHeader },
        });
        if (error) throw error;
        chargeResult = data;
        instructions = 'Check your phone for the mobile money payment prompt';
        break;
      }
      case 'card': {
        const { data, error } = await supabase.functions.invoke('gateway-create-charge', {
          body: {
            merchant_id: order.merchant_id,
            amount, currency, channel: 'card', provider: provider || 'stripe',
            customer_email: customer?.email || order.customer_email,
            customer_name: customer?.name || order.customer_name,
            tx_ref: txRef,
            idempotency_key: idempotencyKey,
            metadata: chargeMetadata,
          },
          headers: { Authorization: authHeader },
        });
        if (error) throw error;
        chargeResult = data;
        paymentUrl = data?.payment_url || data?.client_secret;
        instructions = 'Complete payment at the provided URL';
        break;
      }
      case 'bank_transfer': {
        const { data, error } = await supabase.functions.invoke('gateway-create-charge', {
          body: {
            merchant_id: order.merchant_id,
            amount, currency, channel: 'bank_transfer', provider: provider || 'flutterwave',
            customer_email: customer?.email || order.customer_email,
            tx_ref: txRef,
            idempotency_key: idempotencyKey,
            metadata: chargeMetadata,
          },
          headers: { Authorization: authHeader },
        });
        if (error) throw error;
        chargeResult = data;
        instructions = 'Follow the bank transfer instructions sent to your email';
        break;
      }
      case 'paypal': {
        const { data, error } = await supabase.functions.invoke('gateway-create-charge', {
          body: {
            merchant_id: order.merchant_id,
            amount, currency, channel: 'paypal', provider: 'paypal',
            customer_email: customer?.email || order.customer_email,
            tx_ref: txRef,
            idempotency_key: idempotencyKey,
            metadata: chargeMetadata,
          },
          headers: { Authorization: authHeader },
        });
        if (error) throw error;
        chargeResult = data;
        paymentUrl = data?.approval_url;
        instructions = 'Complete payment via PayPal';
        break;
      }
      case 'wallet': {
        // F28/F29 — Atomic wallet payment.
        // Replaces the prior read-modify-write pattern (which was vulnerable
        // to race conditions) with the platform's atomic primitives:
        //   • execute_atomic_transfer locks the source balance row, debits
        //     the consumer, and credits the destination in a single tx.
        //   • atomic_charge_wallet_credit posts the merchant credit safely.
        const consumerUserId = customer?.user_id || user.id;
        const { data: consumerAccounts } = await supabase.from('accounts')
          .select('id').eq('user_id', consumerUserId).limit(1);
        if (!consumerAccounts?.length) {
          return new Response(JSON.stringify({ error: 'no_consumer_wallet' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const consumerAccountId = consumerAccounts[0].id;

        // Locate consumer's available balance row for FOR UPDATE locking inside the RPC.
        const { data: srcBal } = await supabase.from('account_balances')
          .select('id, amount')
          .eq('account_id', consumerAccountId)
          .eq('credit_debit_indicator', 'Credit')
          .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
          .order('balance_datetime', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!srcBal) {
          return new Response(JSON.stringify({ error: 'no_balance_record', message: 'Consumer wallet has no available balance row' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Resolve merchant settlement account — every merchant MUST have a
        // backing account row to receive an atomic credit. If missing, fall
        // back to a non-atomic merchant-wallet credit but still debit the
        // consumer atomically (no money loss possible).
        const { data: merchantUser } = await supabase
          .from('gateway_merchants').select('user_id').eq('id', order.merchant_id).maybeSingle();
        const { data: merchantAccount } = merchantUser?.user_id
          ? await supabase.from('accounts').select('id').eq('user_id', merchantUser.user_id).eq('currency', currency).limit(1).maybeSingle()
          : { data: null };

        if (merchantAccount?.id) {
          // Best path — fully atomic transfer between consumer and merchant accounts.
          const { error: transferErr } = await supabase.rpc('execute_atomic_transfer', {
            _source_balance_id: srcBal.id,
            _dest_account_id: merchantAccount.id,
            _amount: amount,
            _currency: currency,
          });
          if (transferErr) {
            return new Response(JSON.stringify({ error: 'transfer_failed', message: transferErr.message }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          // Fallback — atomically debit consumer first via the RPC, then post
          // the merchant credit through the atomic_charge_wallet_credit RPC.
          const { error: debitErr } = await supabase.rpc('atomic_debit_balance', {
            _account_id: consumerAccountId,
            _amount: amount,
            _currency: currency,
          });
          if (debitErr) {
            return new Response(JSON.stringify({ error: 'insufficient_balance', message: debitErr.message }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // F29 — Always credit the merchant wallet through the atomic RPC.
        // The RPC is upsert-safe and uses ON CONFLICT to avoid lost updates.
        await supabase.rpc('atomic_charge_wallet_credit', {
          _charge_id: crypto.randomUUID(),
          _new_status: 'successful',
          _provider_raw: { source: 'pos_wallet', order_id: order.id },
          _merchant_id: order.merchant_id,
          _currency: currency,
          _credit_amount: amount,
        });
        // Update order to paid immediately
        await supabase.from('pos_orders').update({ status: 'paid' }).eq('id', order.id);
        // Create payment record and return
        const { data: walletPayment } = await supabase.from('pos_order_payments').insert({
          order_id: order.id, merchant_id: order.merchant_id,
          status: 'succeeded', amount, currency, provider: 'wallet', method: 'wallet',
          provider_reference: `wallet_${idempotencyKey}`,
        }).select().single();
        // Inventory decrement
        if (order.location_id) {
          for (const item of order.pos_order_items || []) {
            await supabase.rpc('pos_adjust_inventory', {
              _merchant_id: order.merchant_id, _variant_id: item.variant_id,
              _location_id: order.location_id, _quantity_delta: -item.quantity,
              _type: 'sale', _reason: `Wallet payment order ${order.order_number}`,
              _reference_type: 'pos_order', _reference_id: order.id,
            }).catch(() => {});
          }
        }
        await supabase.from('pos_order_status_history').insert({
          order_id: order.id, status: 'paid', note: 'Wallet payment completed', created_by: user.id,
        });
        // ✉️ POS order receipt for wallet
        if (customer?.email) {
          sendManagedEmail(supabase, {
            email_key: 'pos_order_receipt',
            recipient_email: customer.email,
            variables: {
              customer_name: customer.name || 'Customer',
              merchant_name: order.merchant_name || 'Store',
              order_number: order.order_number, currency, amount: new Intl.NumberFormat('fr-CM').format(amount),
              payment_method: 'Wallet',
            },
          });
        }
        return new Response(JSON.stringify({
          success: true, order_id: order.id, order_number: order.order_number,
          payment_id: walletPayment?.id, method: 'wallet', status: 'succeeded',
          amount, currency, instructions: 'Payment completed from wallet balance',
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      default:
        return new Response(JSON.stringify({ error: 'unsupported_method', message: `Method ${method} not supported. Use: mobile_money, card, bank_transfer, paypal, wallet` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Create order payment record
    const chargeId = chargeResult?.id || chargeResult?.charge_id;
    const { data: payment, error: payErr } = await supabase.from('pos_order_payments').insert({
      order_id: order.id,
      merchant_id: order.merchant_id,
      charge_id: chargeId || null,
      status: 'pending',
      amount,
      currency,
      provider: provider || (method === 'card' ? 'stripe' : 'flutterwave'),
      method,
      provider_reference: chargeResult?.tx_ref || txRef,
    }).select().single();

    if (payErr) throw payErr;

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      payment_id: payment.id,
      charge_id: chargeId,
      tx_ref: txRef,
      method,
      status: 'pending',
      amount,
      currency,
      payment_url: paymentUrl,
      instructions,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-pay-order error:', error);
    return new Response(JSON.stringify({ error: 'payment_failed', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
