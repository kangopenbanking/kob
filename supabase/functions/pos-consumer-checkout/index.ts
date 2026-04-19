import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

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
      return new Response(JSON.stringify({ error: 'missing_idempotency_key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    const body = await req.json();
    const { cart_id } = body;

    if (!cart_id) {
      return new Response(JSON.stringify({ error: 'cart_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch cart with items
    const { data: cart, error: cartErr } = await supabase.from('pos_consumer_carts')
      .select('*, pos_consumer_cart_items(*, pos_product_variants(id, name, sku, price, product_id, pos_products(name)))')
      .eq('id', cart_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (cartErr || !cart) {
      return new Response(JSON.stringify({ error: 'cart_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const items = cart.pos_consumer_cart_items || [];
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'cart_empty' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate total (subtotal + shipping fee captured during cart)
    let subtotal = 0;
    const orderItems: any[] = [];
    for (const item of items) {
      const variant = item.pos_product_variants;
      const lineTotal = item.unit_price * item.quantity;
      subtotal += lineTotal;
      orderItems.push({
        merchant_id: cart.merchant_id,
        product_id: variant?.product_id,
        variant_id: item.variant_id,
        name_snapshot: variant?.pos_products?.name ? `${variant.pos_products.name} - ${variant.name}` : variant?.name,
        sku_snapshot: variant?.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_amount: 0,
        discount_amount: 0,
        line_total: lineTotal,
      });
    }

    const shippingFee = Number(cart.shipping_fee || 0);
    const total = subtotal + shippingFee;

    // Get consumer's wallet (account balance)
    const { data: consumerAccounts } = await supabase.from('accounts')
      .select('id').eq('user_id', user.id).limit(1);
    if (!consumerAccounts || consumerAccounts.length === 0) {
      return new Response(JSON.stringify({ error: 'no_wallet', message: 'No wallet account found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const consumerAccountId = consumerAccounts[0].id;

    // Check balance
    const { data: balance } = await supabase.from('account_balances')
      .select('amount')
      .eq('account_id', consumerAccountId)
      .eq('balance_type', 'ClosingAvailable')
      .maybeSingle();

    const availableBalance = balance?.amount || 0;
    if (availableBalance < total) {
      return new Response(JSON.stringify({ error: 'insufficient_balance', available: availableBalance, required: total }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create POS order with channel=consumer_app and full shipping snapshot
    const { data: order, error: orderErr } = await supabase.from('pos_orders').insert({
      merchant_id: cart.merchant_id,
      channel: 'consumer_app',
      status: 'paid',
      currency: 'XAF',
      subtotal,
      tax_total: 0,
      discount_total: 0,
      total,
      shipping_fee: shippingFee,
      shipping_recipient_name: cart.shipping_recipient_name,
      shipping_phone: cart.shipping_phone,
      shipping_address_line: cart.shipping_address_line,
      shipping_city: cart.shipping_city,
      shipping_region: cart.shipping_region,
      shipping_country: cart.shipping_country,
      shipping_postal_code: cart.shipping_postal_code,
      delivery_notes: cart.delivery_notes,
      customer_name: cart.shipping_recipient_name || user.user_metadata?.full_name || user.email,
      customer_email: user.email,
      customer_phone: cart.shipping_phone || user.phone || null,
      metadata_json: { idempotency_key: idempotencyKey, consumer_user_id: user.id },
    }).select().single();
    if (orderErr) throw orderErr;

    // Insert order items
    const itemsWithOrderId = orderItems.map(i => ({ ...i, order_id: order.id }));
    await supabase.from('pos_order_items').insert(itemsWithOrderId);

    // Create payment record
    await supabase.from('pos_order_payments').insert({
      order_id: order.id,
      merchant_id: cart.merchant_id,
      status: 'succeeded',
      amount: total,
      currency: 'XAF',
      provider: 'wallet',
      method: 'wallet',
      provider_reference: `wallet_${idempotencyKey}`,
    });

    // Debit consumer balance
    await supabase.from('account_balances').upsert({
      account_id: consumerAccountId,
      balance_type: 'ClosingAvailable',
      amount: availableBalance - total,
      currency: 'XAF',
      credit_debit_indicator: 'Debit',
      balance_datetime: new Date().toISOString(),
    }, { onConflict: 'account_id,balance_type' });

    // Credit merchant wallet
    const { data: merchantWallet } = await supabase.from('gateway_merchant_wallets')
      .select('id, available_balance, ledger_balance')
      .eq('merchant_id', cart.merchant_id)
      .eq('currency', 'XAF')
      .maybeSingle();

    if (merchantWallet) {
      await supabase.from('gateway_merchant_wallets').update({
        available_balance: (merchantWallet.available_balance || 0) + total,
        ledger_balance: (merchantWallet.ledger_balance || 0) + total,
        updated_at: new Date().toISOString(),
      }).eq('id', merchantWallet.id);
    } else {
      await supabase.from('gateway_merchant_wallets').insert({
        merchant_id: cart.merchant_id,
        currency: 'XAF',
        available_balance: total,
        pending_balance: 0,
        ledger_balance: total,
      });
    }

    // Decrement inventory for each item — find default location for merchant
    const { data: defaultLocation } = await supabase.from('merchant_locations')
      .select('id').eq('merchant_id', cart.merchant_id).limit(1).maybeSingle();

    if (defaultLocation) {
      for (const item of items) {
        await supabase.rpc('pos_adjust_inventory', {
          _merchant_id: cart.merchant_id,
          _variant_id: item.variant_id,
          _location_id: defaultLocation.id,
          _quantity_delta: -item.quantity,
          _type: 'sale',
          _reason: `Consumer app order ${order.order_number}`,
          _reference_type: 'pos_order',
          _reference_id: order.id,
        }).catch(() => { /* inventory optional */ });
      }
    }

    // Status history
    await supabase.from('pos_order_status_history').insert({
      order_id: order.id, status: 'paid', note: 'Consumer wallet checkout', created_by: user.id,
    });

    // Mark cart as checked out
    await supabase.from('pos_consumer_carts').update({ status: 'checked_out', updated_at: new Date().toISOString() }).eq('id', cart_id);

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      subtotal,
      shipping_fee: shippingFee,
      total,
      currency: 'XAF',
      payment_method: 'wallet',
    }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-consumer-checkout error:', error);
    return new Response(JSON.stringify({ error: 'checkout_failed', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
