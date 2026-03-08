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

    const url = new URL(req.url);

    // POST: Create order
    if (req.method === 'POST') {
      const body = await req.json();
      const { merchant_id, location_id, items, customer, channel, discounts, metadata } = body;

      if (!merchant_id || !items || items.length === 0) {
        return new Response(JSON.stringify({ error: 'merchant_id and items[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify merchant
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) {
        // Check if user is POS staff
        const { data: staff } = await supabase.from('merchant_pos_staff').select('id').eq('merchant_id', merchant_id).eq('user_id', user.id).eq('status', 'active').single();
        if (!staff) {
          return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Fetch variant details for pricing snapshot
      const variantIds = items.map((i: any) => i.variant_id);
      const { data: variants, error: varErr } = await supabase.from('pos_product_variants')
        .select('id, name, sku, price, product_id, pos_products(name)')
        .in('id', variantIds);
      if (varErr) throw varErr;

      const variantMap = new Map(variants?.map(v => [v.id, v]) || []);

      // Calculate totals
      let subtotal = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const variant = variantMap.get(item.variant_id);
        if (!variant) {
          return new Response(JSON.stringify({ error: `variant_not_found: ${item.variant_id}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const unitPrice = item.unit_price || variant.price;
        const qty = item.quantity || 1;
        const taxAmount = item.tax_amount || 0;
        const discountAmount = item.discount_amount || 0;
        const lineTotal = (unitPrice * qty) + taxAmount - discountAmount;

        subtotal += lineTotal;
        orderItems.push({
          merchant_id,
          product_id: variant.product_id,
          variant_id: variant.id,
          name_snapshot: (variant as any).pos_products?.name ? `${(variant as any).pos_products.name} - ${variant.name}` : variant.name,
          sku_snapshot: variant.sku,
          quantity: qty,
          unit_price: unitPrice,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          line_total: lineTotal,
        });
      }

      const taxTotal = orderItems.reduce((s, i) => s + i.tax_amount, 0);
      const discountTotal = (discounts?.amount || 0) + orderItems.reduce((s, i) => s + i.discount_amount, 0);
      const total = subtotal - (discounts?.amount || 0);

      // Create order
      const { data: order, error: orderErr } = await supabase.from('pos_orders').insert({
        merchant_id,
        location_id: location_id || null,
        channel: channel || 'pos',
        status: 'draft',
        currency: 'XAF',
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        total,
        customer_name: customer?.name || null,
        customer_email: customer?.email || null,
        customer_phone: customer?.phone || null,
        metadata_json: metadata || {},
      }).select().single();

      if (orderErr) throw orderErr;

      // Create order items
      const itemsWithOrderId = orderItems.map(i => ({ ...i, order_id: order.id }));
      const { error: itemsErr } = await supabase.from('pos_order_items').insert(itemsWithOrderId);
      if (itemsErr) throw itemsErr;

      // Status history
      await supabase.from('pos_order_status_history').insert({
        order_id: order.id, status: 'draft', note: 'Order created', created_by: user.id,
      });

      return new Response(JSON.stringify({ ...order, items: itemsWithOrderId }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET: List/Get orders
    if (req.method === 'GET') {
      const orderId = url.searchParams.get('order_id');
      const merchantId = url.searchParams.get('merchant_id');

      if (orderId) {
        const { data, error } = await supabase.from('pos_orders')
          .select('*, pos_order_items(*), pos_order_payments(*), pos_order_status_history(*)')
          .eq('id', orderId)
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id or order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let query = supabase.from('pos_orders')
        .select('*, pos_order_items(count)', { count: 'exact' })
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      const status = url.searchParams.get('status');
      if (status) query = query.eq('status', status);
      const ch = url.searchParams.get('channel');
      if (ch) query = query.eq('channel', ch);
      const from = url.searchParams.get('from');
      if (from) query = query.gte('created_at', from);
      const to = url.searchParams.get('to');
      if (to) query = query.lte('created_at', to);
      const search = url.searchParams.get('search');
      if (search) query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);

      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ orders: data, total: count, limit, offset }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-orders error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
