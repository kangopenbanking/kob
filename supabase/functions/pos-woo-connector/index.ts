import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * WooCommerce Connector — Connect store + Import products + Push orders
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Hardening: AUTH IS THE FIRST GATE ────────────────────────────────
    // Do NOT read / parse / validate the request body before this block.
    // Returning field-level validation errors before authentication would
    // leak the API contract (expected fields, accepted actions) to
    // unauthenticated callers. Body parsing happens only after a verified
    // JWT and a resolved Supabase user.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Only now do we touch the body.
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { action } = body || {};
    if (!action || typeof action !== 'string') {
      return new Response(JSON.stringify({ error: 'action required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    switch (action) {
      case 'connect':
        return await handleConnect(supabase, user, body);
      case 'import_products':
        return await handleImportProducts(supabase, user, body);
      case 'push_order':
        return await handlePushOrder(supabase, user, body);
      case 'disconnect':
        return await handleDisconnect(supabase, user, body);
      default:
        return new Response(JSON.stringify({ error: 'invalid_action', message: 'Use: connect, import_products, push_order, disconnect' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('pos-woo-connector error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleConnect(supabase: any, user: any, body: any) {
  const { merchant_id, store_url, consumer_key, consumer_secret, default_location_id } = body;

  if (!merchant_id || !store_url || !consumer_key || !consumer_secret) {
    return new Response(JSON.stringify({ error: 'merchant_id, store_url, consumer_key, consumer_secret required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Verify merchant ownership
  const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
  if (!merchant) {
    return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Validate credentials by calling Woo REST API
  const cleanUrl = store_url.replace(/\/$/, '');
  try {
    const testRes = await fetch(`${cleanUrl}/wp-json/wc/v3/system_status`, {
      headers: { 'Authorization': 'Basic ' + btoa(`${consumer_key}:${consumer_secret}`) },
    });
    if (!testRes.ok) {
      const errText = await testRes.text();
      return new Response(JSON.stringify({ error: 'woo_connection_failed', message: `WooCommerce API returned ${testRes.status}: ${errText.slice(0, 200)}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (fetchErr) {
    return new Response(JSON.stringify({ error: 'woo_unreachable', message: `Cannot reach ${cleanUrl}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Generate webhook secret
  const webhookSecret = `whsec_pos_${crypto.randomUUID().replace(/-/g, '')}`;

  // Upsert integration
  const { data: integration, error: intErr } = await supabase.from('merchant_integrations').upsert({
    merchant_id,
    type: 'woocommerce',
    status: 'connected',
    base_url: cleanUrl,
    credentials_json: { consumer_key, consumer_secret },
    webhook_secret: webhookSecret,
    settings_json: {
      sync_strategy: 'woo_source_of_truth',
      default_location_id: default_location_id || null,
    },
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'merchant_id,type' }).select().single();

  if (intErr) throw intErr;

  return new Response(JSON.stringify({
    success: true,
    integration_id: integration.id,
    status: 'connected',
    webhook_secret: webhookSecret,
    recommended_webhooks: [
      'product.created', 'product.updated', 'product.deleted',
      'order.created', 'order.updated',
    ],
    webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-woo-webhook-ingestion`,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleImportProducts(supabase: any, user: any, body: any) {
  const { merchant_id, mode, since, include, merge_strategy } = body;

  if (!merchant_id) {
    return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Get integration
  const { data: integration, error: intErr } = await supabase.from('merchant_integrations')
    .select('*')
    .eq('merchant_id', merchant_id)
    .eq('type', 'woocommerce')
    .eq('status', 'connected')
    .single();

  if (intErr || !integration) {
    return new Response(JSON.stringify({ error: 'integration_not_connected' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const creds = integration.credentials_json as any;
  const baseUrl = integration.base_url;
  const authHeader = 'Basic ' + btoa(`${creds.consumer_key}:${creds.consumer_secret}`);

  // Create sync run
  const { data: syncRun } = await supabase.from('integration_sync_runs').insert({
    integration_id: integration.id,
    merchant_id,
    mode: mode || 'full',
    status: 'running',
  }).select().single();

  try {
    // Fetch products from WooCommerce
    let wooUrl = `${baseUrl}/wp-json/wc/v3/products?per_page=100`;
    if (mode === 'incremental' && since) {
      wooUrl += `&modified_after=${since}`;
    }

    const wooRes = await fetch(wooUrl, { headers: { 'Authorization': authHeader } });
    if (!wooRes.ok) throw new Error(`WooCommerce API error: ${wooRes.status}`);
    const wooProducts = await wooRes.json();

    let imported = 0, updated = 0, skipped = 0;
    const locationId = (integration.settings_json as any)?.default_location_id;

    for (const wp of wooProducts) {
      const includeType = include || 'both';
      if (includeType === 'simple' && wp.type === 'variable') continue;
      if (includeType === 'variable' && wp.type === 'simple') continue;

      // Check existing mapping
      const { data: existingMapping } = await supabase.from('integration_mappings')
        .select('kob_id')
        .eq('integration_id', integration.id)
        .eq('entity_type', 'product')
        .eq('external_id', String(wp.id))
        .single();

      if (existingMapping) {
        // Update existing product if woo_source_of_truth
        if ((merge_strategy || 'woo_source_of_truth') === 'woo_source_of_truth') {
          await supabase.from('pos_products').update({
            name: wp.name,
            description: wp.description?.replace(/<[^>]*>/g, '') || null,
            status: wp.status === 'publish' ? 'active' : 'inactive',
          }).eq('id', existingMapping.kob_id);
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Create product
      const { data: product, error: prodErr } = await supabase.from('pos_products').insert({
        merchant_id,
        name: wp.name,
        description: wp.description?.replace(/<[^>]*>/g, '') || null,
        status: wp.status === 'publish' ? 'active' : 'inactive',
        currency: 'XAF',
        source: 'woocommerce',
      }).select().single();

      if (prodErr) { skipped++; continue; }

      // Create mapping
      await supabase.from('integration_mappings').insert({
        merchant_id,
        integration_id: integration.id,
        entity_type: 'product',
        kob_id: product.id,
        external_id: String(wp.id),
      });

      // Create variants
      if (wp.type === 'variable' && wp.variations?.length > 0) {
        // Fetch variations
        const varRes = await fetch(`${baseUrl}/wp-json/wc/v3/products/${wp.id}/variations?per_page=100`, {
          headers: { 'Authorization': authHeader },
        });
        const variations = varRes.ok ? await varRes.json() : [];

        for (const v of variations) {
          const attrs = v.attributes?.map((a: any) => `${a.name}: ${a.option}`).join(', ') || 'Default';
          const { data: variant } = await supabase.from('pos_product_variants').insert({
            product_id: product.id,
            merchant_id,
            sku: v.sku || null,
            name: attrs,
            attributes_json: v.attributes || {},
            price: parseFloat(v.price || '0'),
            cost_price: null,
            track_inventory: v.manage_stock || false,
          }).select().single();

          if (variant) {
            await supabase.from('integration_mappings').insert({
              merchant_id,
              integration_id: integration.id,
              entity_type: 'variant',
              kob_id: variant.id,
              external_id: String(v.id),
            });

            // Seed inventory
            if (v.manage_stock && v.stock_quantity != null && locationId) {
              await supabase.rpc('pos_adjust_inventory', {
                _merchant_id: merchant_id,
                _variant_id: variant.id,
                _location_id: locationId,
                _quantity_delta: v.stock_quantity,
                _type: 'sync_adjust',
                _reason: 'WooCommerce initial import',
              });
            }
          }
        }
      } else {
        // Simple product → single variant
        const { data: variant } = await supabase.from('pos_product_variants').insert({
          product_id: product.id,
          merchant_id,
          sku: wp.sku || null,
          name: 'Default',
          price: parseFloat(wp.price || '0'),
          track_inventory: wp.manage_stock || false,
        }).select().single();

        if (variant) {
          await supabase.from('integration_mappings').insert({
            merchant_id,
            integration_id: integration.id,
            entity_type: 'variant',
            kob_id: variant.id,
            external_id: String(wp.id),
          });

          if (wp.manage_stock && wp.stock_quantity != null && locationId) {
            await supabase.rpc('pos_adjust_inventory', {
              _merchant_id: merchant_id,
              _variant_id: variant.id,
              _location_id: locationId,
              _quantity_delta: wp.stock_quantity,
              _type: 'sync_adjust',
              _reason: 'WooCommerce initial import',
            });
          }
        }
      }

      imported++;
    }

    // Update sync run
    await supabase.from('integration_sync_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      summary_json: { total_fetched: wooProducts.length, imported, updated, skipped },
    }).eq('id', syncRun.id);

    await supabase.from('merchant_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id);

    return new Response(JSON.stringify({
      success: true,
      sync_run_id: syncRun.id,
      summary: { total_fetched: wooProducts.length, imported, updated, skipped },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (importErr) {
    await supabase.from('integration_sync_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: importErr instanceof Error ? importErr.message : 'Unknown',
    }).eq('id', syncRun.id);
    throw importErr;
  }
}

async function handlePushOrder(supabase: any, user: any, body: any) {
  const { merchant_id, order_id } = body;

  if (!merchant_id || !order_id) {
    return new Response(JSON.stringify({ error: 'merchant_id and order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: integration } = await supabase.from('merchant_integrations')
    .select('*')
    .eq('merchant_id', merchant_id)
    .eq('type', 'woocommerce')
    .eq('status', 'connected')
    .single();

  if (!integration) {
    return new Response(JSON.stringify({ error: 'integration_not_connected' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: order } = await supabase.from('pos_orders')
    .select('*, pos_order_items(*)')
    .eq('id', order_id)
    .single();

  if (!order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const creds = integration.credentials_json as any;
  const wooUrl = `${integration.base_url}/wp-json/wc/v3/orders`;

  // Map order items to Woo line items
  const lineItems = [];
  for (const item of order.pos_order_items || []) {
    // Try to find Woo product ID from mapping
    const { data: mapping } = await supabase.from('integration_mappings')
      .select('external_id')
      .eq('integration_id', integration.id)
      .eq('entity_type', 'variant')
      .eq('kob_id', item.variant_id)
      .single();

    lineItems.push({
      product_id: mapping ? parseInt(mapping.external_id) : undefined,
      name: item.name_snapshot,
      quantity: item.quantity,
      total: String(item.line_total),
    });
  }

  const wooOrder = {
    status: order.status === 'paid' ? 'processing' : 'pending',
    currency: order.currency,
    billing: {
      first_name: order.customer_name || '',
      email: order.customer_email || '',
      phone: order.customer_phone || '',
    },
    line_items: lineItems,
    meta_data: [{ key: '_kob_order_id', value: order.id }, { key: '_kob_order_number', value: order.order_number }],
  };

  const wooRes = await fetch(wooUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${creds.consumer_key}:${creds.consumer_secret}`),
    },
    body: JSON.stringify(wooOrder),
  });

  if (!wooRes.ok) {
    const errText = await wooRes.text();
    return new Response(JSON.stringify({ error: 'woo_push_failed', message: errText.slice(0, 500) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const wooResult = await wooRes.json();

  // Save mapping
  await supabase.from('integration_mappings').upsert({
    merchant_id,
    integration_id: integration.id,
    entity_type: 'order',
    kob_id: order.id,
    external_id: String(wooResult.id),
  }, { onConflict: 'integration_id,entity_type,external_id' });

  // Update order external_reference
  await supabase.from('pos_orders').update({ external_reference: String(wooResult.id) }).eq('id', order.id);

  return new Response(JSON.stringify({
    success: true,
    woo_order_id: wooResult.id,
    woo_order_number: wooResult.number,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDisconnect(supabase: any, user: any, body: any) {
  const { merchant_id } = body;
  if (!merchant_id) {
    return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await supabase.from('merchant_integrations')
    .update({ status: 'disconnected', credentials_json: {} })
    .eq('merchant_id', merchant_id)
    .eq('type', 'woocommerce');

  return new Response(JSON.stringify({ success: true, status: 'disconnected' }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
