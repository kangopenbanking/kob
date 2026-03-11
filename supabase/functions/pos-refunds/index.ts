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
      return new Response(JSON.stringify({ error: 'missing_idempotency_key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { order_id, items, reason, refund_method, amount } = body;

      if (!order_id || !items || items.length === 0) {
        return new Response(JSON.stringify({ error: 'order_id and items[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fetch order
      const { data: order, error: orderErr } = await supabase.from('pos_orders')
        .select('*, pos_order_payments(*)')
        .eq('id', order_id)
        .single();
      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!['paid', 'completed', 'partially_refunded'].includes(order.status)) {
        return new Response(JSON.stringify({ error: 'invalid_order_status', message: `Cannot refund order with status: ${order.status}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate refund amount from items
      let refundAmount = 0;
      const returnItems: any[] = [];

      for (const item of items) {
        const { data: orderItem } = await supabase.from('pos_order_items')
          .select('*')
          .eq('id', item.order_item_id)
          .eq('order_id', order_id)
          .single();

        if (!orderItem) {
          return new Response(JSON.stringify({ error: `order_item_not_found: ${item.order_item_id}` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const itemAmount = item.amount || (orderItem.unit_price * item.quantity);
        refundAmount += itemAmount;
        returnItems.push({
          order_item_id: item.order_item_id,
          quantity: item.quantity,
          amount: itemAmount,
          restock: item.restock !== false,
        });
      }

      const finalAmount = amount || refundAmount;

      // Create return record
      let gatewayRefundId: string | null = null;

      // Trigger gateway refund if provider_refund
      if (refund_method !== 'manual_refund') {
        const successfulPayment = order.pos_order_payments?.find((p: any) => p.status === 'succeeded');
        if (successfulPayment?.charge_id) {
          const { data: refundData, error: refundErr } = await supabase.functions.invoke('gateway-create-refund', {
            body: {
              charge_id: successfulPayment.charge_id,
              amount: finalAmount,
              reason: reason || 'POS return',
              idempotency_key: idempotencyKey,
            },
            headers: { Authorization: authHeader },
          });
          if (refundErr) {
            console.error('Gateway refund failed:', refundErr);
          } else {
            gatewayRefundId = refundData?.id || refundData?.refund_id;
          }
        }
      }

      // Create return
      const { data: returnRecord, error: retErr } = await supabase.from('pos_returns').insert({
        order_id,
        merchant_id: order.merchant_id,
        status: 'processed',
        reason: reason || 'Customer return',
        refund_id: gatewayRefundId,
      }).select().single();

      if (retErr) throw retErr;

      // Create return items
      const retItems = returnItems.map(i => ({ ...i, return_id: returnRecord.id }));
      await supabase.from('pos_return_items').insert(retItems);

      // Restock inventory
      for (const item of items) {
        if (item.restock !== false) {
          const { data: orderItem } = await supabase.from('pos_order_items')
            .select('variant_id')
            .eq('id', item.order_item_id)
            .single();

          if (orderItem?.variant_id && order.location_id) {
            await supabase.rpc('pos_adjust_inventory', {
              _merchant_id: order.merchant_id,
              _variant_id: orderItem.variant_id,
              _location_id: order.location_id,
              _quantity_delta: item.quantity,
              _type: 'refund',
              _reason: `Return for order ${order.order_number}`,
              _reference_type: 'pos_return',
              _reference_id: returnRecord.id,
            });
          }
        }
      }

      // Determine if full or partial refund
      const isFullRefund = finalAmount >= order.total;
      const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

      await supabase.from('pos_orders').update({ status: newStatus }).eq('id', order_id);
      await supabase.from('pos_order_status_history').insert({
        order_id, status: newStatus,
        note: `${isFullRefund ? 'Full' : 'Partial'} refund of ${order.currency} ${finalAmount}. Reason: ${reason || 'N/A'}`,
        created_by: user.id,
      });

      // If Woo order, sync refund
      if (order.channel === 'woocommerce' && order.external_reference) {
        // Find integration
        const { data: integration } = await supabase.from('merchant_integrations')
          .select('*')
          .eq('merchant_id', order.merchant_id)
          .eq('type', 'woocommerce')
          .eq('status', 'connected')
          .single();

        if (integration?.base_url && integration?.credentials_json) {
          try {
            const creds = integration.credentials_json as any;
            const wooUrl = `${integration.base_url}/wp-json/wc/v3/orders/${order.external_reference}/refunds`;
            await fetch(wooUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${creds.consumer_key}:${creds.consumer_secret}`),
              },
              body: JSON.stringify({
                amount: String(finalAmount),
                reason: reason || 'POS refund',
              }),
            });
          } catch (wooErr) {
            console.error('Failed to sync refund to WooCommerce:', wooErr);
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        return_id: returnRecord.id,
        refund_id: gatewayRefundId,
        amount: finalAmount,
        currency: order.currency,
        order_status: newStatus,
        items_restocked: returnItems.filter(i => i.restock).length,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET: List refunds for an order
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const orderId = url.searchParams.get('order_id');
      if (!orderId) {
        return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase.from('pos_returns')
        .select('*, pos_return_items(*)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ returns: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-refunds error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
