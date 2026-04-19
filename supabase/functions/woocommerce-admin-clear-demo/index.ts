import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

// Admin-only: clear WooCommerce demo data across both tracks (legacy plugin + POS connector)
// Scopes: 'legacy' | 'pos_connector' | 'all'
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return j({ error: 'unauthorized' }, 401);
    if (req.method !== 'POST') return j({ error: 'method_not_allowed' }, 405);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return j({ error: 'unauthorized' }, 401);

    // Verify admin role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();
    if (!roleRow) return j({ error: 'forbidden', message: 'Admin role required' }, 403);

    const body = await req.json().catch(() => ({}));
    const scope: 'legacy' | 'pos_connector' | 'all' = body.scope || 'all';
    const dryRun: boolean = body.dry_run === true;

    const counts: Record<string, number> = {};
    const ALL_ID = '00000000-0000-0000-0000-000000000000';

    const wipe = async (table: string) => {
      if (dryRun) {
        const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
        counts[table] = count || 0;
        return;
      }
      const { count } = await supabase.from(table).delete({ count: 'exact' }).neq('id', ALL_ID);
      counts[table] = count || 0;
    };

    if (scope === 'legacy' || scope === 'all') {
      // Legacy plugin tables — order matters (transactions reference merchants)
      await wipe('woocommerce_transactions');
      await wipe('woocommerce_merchants');
    }

    if (scope === 'pos_connector' || scope === 'all') {
      // Clear pos products imported from woocommerce + their dependents
      // Fetch IDs first so we can clean dependents
      const { data: wooProducts } = await supabase
        .from('pos_products')
        .select('id, merchant_id')
        .eq('source', 'woocommerce');
      const productIds = (wooProducts || []).map(p => p.id);

      if (productIds.length > 0 && !dryRun) {
        const { data: variants } = await supabase
          .from('pos_product_variants')
          .select('id')
          .in('product_id', productIds);
        const variantIds = (variants || []).map(v => v.id);

        if (variantIds.length > 0) {
          await supabase.from('pos_inventory_levels').delete().in('variant_id', variantIds);
          await supabase.from('pos_consumer_cart_items').delete().in('variant_id', variantIds);
          await supabase.from('pos_product_variants').delete().in('product_id', productIds);
        }
        await supabase.from('pos_product_images').delete().in('product_id', productIds);
        const { count: pCount } = await supabase.from('pos_products').delete({ count: 'exact' }).in('id', productIds);
        counts['pos_products'] = pCount || 0;
      } else {
        counts['pos_products'] = productIds.length;
      }

      // Integration mappings + sync runs + events tied to woocommerce integrations
      const { data: wooInts } = await supabase
        .from('merchant_integrations')
        .select('id')
        .eq('type', 'woocommerce');
      const intIds = (wooInts || []).map(i => i.id);

      if (intIds.length > 0 && !dryRun) {
        await supabase.from('integration_mappings').delete().in('integration_id', intIds);
        await supabase.from('integration_sync_runs').delete().in('integration_id', intIds);
        await supabase.from('integration_events_inbox').delete().in('integration_id', intIds);
        const { count: iCount } = await supabase.from('merchant_integrations').delete({ count: 'exact' }).in('id', intIds);
        counts['merchant_integrations'] = iCount || 0;
      } else {
        counts['merchant_integrations'] = intIds.length;
      }
    }

    return j({ success: true, scope, dry_run: dryRun, counts });
  } catch (error) {
    console.error('woocommerce-admin-clear-demo error:', error);
    return j({ error: 'clear_failed', message: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
