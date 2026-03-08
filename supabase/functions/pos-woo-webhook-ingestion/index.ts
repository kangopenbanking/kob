import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * WooCommerce Webhook Ingestion — receives product/order webhooks from WooCommerce stores.
 * Deduplicates by provider_event_id and updates local catalog/orders.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const rawBody = await req.text();
    const url = new URL(req.url);
    const integrationId = url.searchParams.get('integration_id');
    const signature = req.headers.get('x-wc-webhook-signature') || req.headers.get('x-webhook-signature');
    const topic = req.headers.get('x-wc-webhook-topic') || 'unknown';
    const deliveryId = req.headers.get('x-wc-webhook-delivery-id') || crypto.randomUUID();

    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'integration_id query param required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get integration
    const { data: integration } = await supabase.from('merchant_integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('status', 'connected')
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: 'integration_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify HMAC signature if available
    if (signature && integration.webhook_secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(integration.webhook_secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
      if (computed !== signature) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Dedupe
    const { data: existing } = await supabase.from('integration_events_inbox')
      .select('id')
      .eq('integration_id', integrationId)
      .eq('provider_event_id', deliveryId)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ success: true, deduplicated: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = JSON.parse(rawBody);

    // Record event
    const { data: event } = await supabase.from('integration_events_inbox').insert({
      integration_id: integrationId,
      provider_event_id: deliveryId,
      event_type: topic,
      payload_json: payload,
      status: 'received',
    }).select().single();

    // Process based on topic
    try {
      switch (topic) {
        case 'product.created':
        case 'product.updated':
          await handleProductEvent(supabase, integration, payload, topic);
          break;
        case 'product.deleted':
          await handleProductDeleted(supabase, integration, payload);
          break;
        case 'order.created':
        case 'order.updated':
          await handleOrderEvent(supabase, integration, payload, topic);
          break;
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }

      await supabase.from('integration_events_inbox').update({
        status: 'processed', processed_at: new Date().toISOString(),
      }).eq('id', event.id);

    } catch (processErr) {
      await supabase.from('integration_events_inbox').update({
        status: 'failed', error_message: processErr instanceof Error ? processErr.message : 'Unknown',
      }).eq('id', event.id);
    }

    return new Response(JSON.stringify({ success: true, event_id: event.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('pos-woo-webhook-ingestion error:', error);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleProductEvent(supabase: any, integration: any, payload: any, topic: string) {
  const { data: mapping } = await supabase.from('integration_mappings')
    .select('kob_id')
    .eq('integration_id', integration.id)
    .eq('entity_type', 'product')
    .eq('external_id', String(payload.id))
    .single();

  if (mapping) {
    // Update existing
    await supabase.from('pos_products').update({
      name: payload.name,
      description: payload.description?.replace(/<[^>]*>/g, '') || null,
      status: payload.status === 'publish' ? 'active' : 'inactive',
    }).eq('id', mapping.kob_id);

    // Update stock if managed
    if (payload.manage_stock && payload.stock_quantity != null) {
      const { data: variants } = await supabase.from('pos_product_variants')
        .select('id')
        .eq('product_id', mapping.kob_id);

      const locationId = (integration.settings_json as any)?.default_location_id;
      if (variants && locationId) {
        for (const v of variants) {
          // Get current stock
          const { data: inv } = await supabase.from('pos_inventory_items')
            .select('quantity_on_hand')
            .eq('variant_id', v.id)
            .eq('location_id', locationId)
            .single();

          const delta = payload.stock_quantity - (inv?.quantity_on_hand || 0);
          if (delta !== 0) {
            await supabase.rpc('pos_adjust_inventory', {
              _merchant_id: integration.merchant_id,
              _variant_id: v.id,
              _location_id: locationId,
              _quantity_delta: delta,
              _type: 'sync_adjust',
              _reason: `WooCommerce stock sync (${topic})`,
            });
          }
        }
      }
    }
  } else if (topic === 'product.created') {
    // Auto-import new product
    const { data: product } = await supabase.from('pos_products').insert({
      merchant_id: integration.merchant_id,
      name: payload.name,
      description: payload.description?.replace(/<[^>]*>/g, '') || null,
      status: payload.status === 'publish' ? 'active' : 'inactive',
      currency: 'XAF',
      source: 'woocommerce',
    }).select().single();

    if (product) {
      await supabase.from('integration_mappings').insert({
        merchant_id: integration.merchant_id,
        integration_id: integration.id,
        entity_type: 'product',
        kob_id: product.id,
        external_id: String(payload.id),
      });

      // Create default variant
      const { data: variant } = await supabase.from('pos_product_variants').insert({
        product_id: product.id,
        merchant_id: integration.merchant_id,
        sku: payload.sku || null,
        name: 'Default',
        price: parseFloat(payload.price || '0'),
        track_inventory: payload.manage_stock || false,
      }).select().single();

      if (variant) {
        await supabase.from('integration_mappings').insert({
          merchant_id: integration.merchant_id,
          integration_id: integration.id,
          entity_type: 'variant',
          kob_id: variant.id,
          external_id: String(payload.id),
        });
      }
    }
  }
}

async function handleProductDeleted(supabase: any, integration: any, payload: any) {
  const { data: mapping } = await supabase.from('integration_mappings')
    .select('kob_id')
    .eq('integration_id', integration.id)
    .eq('entity_type', 'product')
    .eq('external_id', String(payload.id))
    .single();

  if (mapping) {
    await supabase.from('pos_products').update({ status: 'archived' }).eq('id', mapping.kob_id);
  }
}

async function handleOrderEvent(supabase: any, integration: any, payload: any, topic: string) {
  const { data: mapping } = await supabase.from('integration_mappings')
    .select('kob_id')
    .eq('integration_id', integration.id)
    .eq('entity_type', 'order')
    .eq('external_id', String(payload.id))
    .single();

  // Map WooCommerce status to POS status
  const statusMap: Record<string, string> = {
    'pending': 'pending_payment',
    'processing': 'paid',
    'on-hold': 'pending_payment',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
    'failed': 'failed',
  };
  const posStatus = statusMap[payload.status] || 'pending_payment';

  if (mapping) {
    // Update existing order
    await supabase.from('pos_orders').update({
      status: posStatus,
      customer_name: `${payload.billing?.first_name || ''} ${payload.billing?.last_name || ''}`.trim(),
      customer_email: payload.billing?.email || null,
      customer_phone: payload.billing?.phone || null,
    }).eq('id', mapping.kob_id);
  } else if (topic === 'order.created') {
    // Create new order from Woo
    const total = parseFloat(payload.total || '0');
    const { data: order } = await supabase.from('pos_orders').insert({
      merchant_id: integration.merchant_id,
      channel: 'woocommerce',
      external_reference: String(payload.id),
      status: posStatus,
      currency: payload.currency || 'XAF',
      subtotal: parseFloat(payload.subtotal || '0'),
      tax_total: parseFloat(payload.total_tax || '0'),
      discount_total: parseFloat(payload.discount_total || '0'),
      total,
      customer_name: `${payload.billing?.first_name || ''} ${payload.billing?.last_name || ''}`.trim(),
      customer_email: payload.billing?.email || null,
      customer_phone: payload.billing?.phone || null,
      metadata_json: { woo_order_number: payload.number },
    }).select().single();

    if (order) {
      await supabase.from('integration_mappings').insert({
        merchant_id: integration.merchant_id,
        integration_id: integration.id,
        entity_type: 'order',
        kob_id: order.id,
        external_id: String(payload.id),
      });

      // Create order items
      for (const li of payload.line_items || []) {
        const { data: variantMapping } = await supabase.from('integration_mappings')
          .select('kob_id')
          .eq('integration_id', integration.id)
          .eq('entity_type', 'variant')
          .eq('external_id', String(li.product_id))
          .single();

        await supabase.from('pos_order_items').insert({
          order_id: order.id,
          merchant_id: integration.merchant_id,
          product_id: null,
          variant_id: variantMapping?.kob_id || null,
          name_snapshot: li.name,
          sku_snapshot: li.sku || null,
          quantity: li.quantity,
          unit_price: parseFloat(li.price || '0'),
          tax_amount: parseFloat(li.total_tax || '0'),
          line_total: parseFloat(li.total || '0'),
        });
      }

      await supabase.from('pos_order_status_history').insert({
        order_id: order.id,
        status: posStatus,
        note: `Imported from WooCommerce order #${payload.number}`,
      });
    }
  }
}
