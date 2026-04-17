import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * POS Payment Finalization — called by gateway webhooks (Flutterwave/Stripe/PayPal)
 * when a POS-linked charge succeeds or fails.
 * 
 * This function is invoked internally by the gateway webhook handlers
 * when they detect a charge with metadata.channel === 'pos'.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // F37: Require either service_role bearer or shared internal secret.
    // This function mutates orders + inventory and must NEVER be callable anonymously.
    const authHeader = req.headers.get('Authorization') || '';
    const internalSecret = req.headers.get('x-internal-secret') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedInternalSecret = Deno.env.get('POS_FINALIZE_INTERNAL_SECRET') || '';

    const isServiceRole =
      authHeader === `Bearer ${serviceRoleKey}` ||
      authHeader.replace(/^Bearer\s+/i, '') === serviceRoleKey;
    const isInternalCaller =
      expectedInternalSecret.length > 0 && internalSecret === expectedInternalSecret;

    if (!isServiceRole && !isInternalCaller) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'pos-finalize-payment is internal-only' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);

    const body = await req.json();
    const { charge_id, status, provider_ref } = body;

    if (!charge_id || !status) {
      return new Response(JSON.stringify({ error: 'charge_id and status required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find order payment linked to this charge
    const { data: payment, error: payErr } = await supabase.from('pos_order_payments')
      .select('*, pos_orders(*)')
      .eq('charge_id', charge_id)
      .single();

    if (payErr || !payment) {
      console.log(`No POS order payment found for charge ${charge_id}, skipping`);
      return new Response(JSON.stringify({ skipped: true, message: 'No POS order linked to this charge' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const order = (payment as any).pos_orders;
    if (!order) {
      return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotency: skip if already finalized
    if (payment.status === 'succeeded' || payment.status === 'failed') {
      console.log(`Payment ${payment.id} already finalized as ${payment.status}, skipping`);
      return new Response(JSON.stringify({ skipped: true, message: 'Already finalized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (status === 'successful' || status === 'succeeded') {
      // Update payment status
      await supabase.from('pos_order_payments').update({
        status: 'succeeded',
        provider_reference: provider_ref || payment.provider_reference,
      }).eq('id', payment.id);

      // Update order status to paid
      await supabase.from('pos_orders').update({ status: 'paid' }).eq('id', order.id);

      // Record status history
      await supabase.from('pos_order_status_history').insert({
        order_id: order.id, status: 'paid', note: `Payment succeeded via ${payment.method}`,
      });

      // Decrement inventory for each order item
      const { data: items } = await supabase.from('pos_order_items')
        .select('variant_id, quantity')
        .eq('order_id', order.id);

      if (items && order.location_id) {
        for (const item of items) {
          if (item.variant_id) {
            await supabase.rpc('pos_adjust_inventory', {
              _merchant_id: order.merchant_id,
              _variant_id: item.variant_id,
              _location_id: order.location_id,
              _quantity_delta: -item.quantity,
              _type: 'sale',
              _reason: `POS Order ${order.order_number}`,
              _reference_type: 'pos_order',
              _reference_id: order.id,
            });
          }
        }
      }

      // Generate receipt payload
      const receipt = {
        order_id: order.id,
        order_number: order.order_number,
        merchant_id: order.merchant_id,
        items: items,
        subtotal: order.subtotal,
        tax_total: order.tax_total,
        discount_total: order.discount_total,
        total: order.total,
        currency: order.currency,
        payment_method: payment.method,
        payment_ref: provider_ref || payment.provider_reference,
        paid_at: new Date().toISOString(),
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
      };

      return new Response(JSON.stringify({ success: true, order_status: 'paid', receipt }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // Payment failed
      await supabase.from('pos_order_payments').update({ status: 'failed' }).eq('id', payment.id);
      await supabase.from('pos_orders').update({ status: 'failed' }).eq('id', order.id);
      await supabase.from('pos_order_status_history').insert({
        order_id: order.id, status: 'failed', note: `Payment failed via ${payment.method}`,
      });

      return new Response(JSON.stringify({ success: false, order_status: 'failed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('pos-finalize-payment error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
