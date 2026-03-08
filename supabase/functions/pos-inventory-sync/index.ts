import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * POS Inventory Sync — Background job to push KOB inventory changes to WooCommerce
 * Supports: woo_source_of_truth (default) and kob_source_of_truth strategies
 * Can be called manually or via cron schedule
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Support both authenticated calls and cron (service_role)
    let merchantFilter: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // Get merchant for this user
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id').eq('user_id', user.id).single();
      if (merchant) merchantFilter = merchant.id;
    }

    // Parse body for optional params
    let body: any = {};
    try { body = await req.json(); } catch { /* no body is fine for cron */ }

    const { merchant_id, direction } = body;
    if (merchant_id) merchantFilter = merchant_id;

    // Get all connected WooCommerce integrations
    let intQuery = supabase.from('merchant_integrations')
      .select('*')
      .eq('type', 'woocommerce')
      .eq('status', 'connected');

    if (merchantFilter) {
      intQuery = intQuery.eq('merchant_id', merchantFilter);
    }

    const { data: integrations, error: intErr } = await intQuery;
    if (intErr) throw intErr;

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No connected WooCommerce integrations found',
        synced: 0,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const integration of integrations) {
      const settings = integration.settings_json as any || {};
      const strategy = settings.sync_strategy || 'woo_source_of_truth';
      const creds = integration.credentials_json as any;

      if (!creds?.consumer_key || !creds?.consumer_secret) {
        results.push({
          integration_id: integration.id,
          merchant_id: integration.merchant_id,
          status: 'skipped',
          reason: 'missing_credentials',
        });
        continue;
      }

      const authStr = 'Basic ' + btoa(`${creds.consumer_key}:${creds.consumer_secret}`);
      const baseUrl = integration.base_url;

      try {
        // Get recent inventory movements that haven't been synced to Woo
        // We look for movements since last_sync_at
        const sinceDate = integration.last_sync_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: movements, error: movErr } = await supabase
          .from('pos_inventory_movements')
          .select('*, pos_product_variants!inner(id, sku)')
          .eq('merchant_id', integration.merchant_id)
          .in('type', ['sale', 'refund', 'manual_adjust'])
          .gte('created_at', sinceDate)
          .order('created_at', { ascending: true });

        if (movErr) throw movErr;

        if (!movements || movements.length === 0) {
          results.push({
            integration_id: integration.id,
            merchant_id: integration.merchant_id,
            status: 'success',
            movements_synced: 0,
            strategy,
          });
          continue;
        }

        // Aggregate net deltas per variant
        const variantDeltas: Record<string, { delta: number; sku: string | null }> = {};
        for (const mv of movements) {
          const vid = mv.variant_id;
          if (!variantDeltas[vid]) {
            variantDeltas[vid] = { delta: 0, sku: (mv as any).pos_product_variants?.sku || null };
          }
          variantDeltas[vid].delta += mv.quantity_delta;
        }

        let synced = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const [variantId, info] of Object.entries(variantDeltas)) {
          if (info.delta === 0) continue; // No net change

          // Find Woo product ID from mapping
          const { data: mapping } = await supabase.from('integration_mappings')
            .select('external_id')
            .eq('integration_id', integration.id)
            .eq('entity_type', 'variant')
            .eq('kob_id', variantId)
            .single();

          if (!mapping) continue; // No Woo mapping, skip

          // Get current KOB inventory level
          const locationId = settings.default_location_id;
          const { data: inv } = await supabase.from('pos_inventory_items')
            .select('quantity_on_hand')
            .eq('variant_id', variantId)
            .eq('location_id', locationId)
            .single();

          const currentQty = inv?.quantity_on_hand ?? 0;

          // Push to WooCommerce — update stock quantity
          try {
            // Determine if this is a product or variation in Woo
            const { data: productMapping } = await supabase.from('integration_mappings')
              .select('external_id')
              .eq('integration_id', integration.id)
              .eq('entity_type', 'product')
              .eq('kob_id', (await supabase.from('pos_product_variants').select('product_id').eq('id', variantId).single()).data?.product_id)
              .single();

            const wooProductId = productMapping?.external_id;
            const wooVariantId = mapping.external_id;

            let updateUrl: string;
            if (wooProductId && wooProductId !== wooVariantId) {
              // It's a variation
              updateUrl = `${baseUrl}/wp-json/wc/v3/products/${wooProductId}/variations/${wooVariantId}`;
            } else {
              // It's a simple product
              updateUrl = `${baseUrl}/wp-json/wc/v3/products/${wooVariantId}`;
            }

            const wooRes = await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authStr,
              },
              body: JSON.stringify({
                manage_stock: true,
                stock_quantity: currentQty,
              }),
            });

            if (wooRes.ok) {
              synced++;
            } else {
              const errText = await wooRes.text();
              errors.push(`Variant ${variantId}: Woo ${wooRes.status} - ${errText.slice(0, 100)}`);
              failed++;
            }
          } catch (pushErr) {
            errors.push(`Variant ${variantId}: ${pushErr instanceof Error ? pushErr.message : 'Unknown'}`);
            failed++;
          }
        }

        // Record sync run
        await supabase.from('integration_sync_runs').insert({
          integration_id: integration.id,
          merchant_id: integration.merchant_id,
          mode: 'incremental',
          status: failed > 0 ? (synced > 0 ? 'success' : 'failed') : 'success',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          summary_json: {
            direction: direction || 'kob_to_woo',
            strategy,
            movements_processed: movements.length,
            variants_synced: synced,
            variants_failed: failed,
            errors: errors.slice(0, 10),
          },
        });

        // Update last_sync_at
        await supabase.from('merchant_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

        results.push({
          integration_id: integration.id,
          merchant_id: integration.merchant_id,
          status: 'success',
          movements_processed: movements.length,
          variants_synced: synced,
          variants_failed: failed,
          strategy,
        });

      } catch (syncErr) {
        results.push({
          integration_id: integration.id,
          merchant_id: integration.merchant_id,
          status: 'error',
          error: syncErr instanceof Error ? syncErr.message : 'Unknown',
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced_integrations: results.length,
      results,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-inventory-sync error:', error);
    return new Response(JSON.stringify({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
