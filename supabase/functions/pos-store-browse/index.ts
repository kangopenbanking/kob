import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // F40: Public storefront discovery — read-only, no auth required.
    // Marketplace browsing must be indexable and shareable; only returns
    // is_published = true rows with active subscriptions.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET ?action=stores — List published stores with active subscriptions
    if (action === 'stores') {
      const city = url.searchParams.get('city');
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Get merchant_ids with active subscriptions first (no FK exists between these tables)
      const { data: activeSubs } = await supabase
        .from('pos_store_subscriptions')
        .select('merchant_id')
        .eq('status', 'active');

      const activeMerchantIds = (activeSubs || []).map((s: any) => s.merchant_id);

      if (activeMerchantIds.length === 0) {
        return new Response(JSON.stringify({ stores: [], total: 0, limit, offset }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let query = supabase.from('pos_store_profiles')
        .select('*', { count: 'exact' })
        .eq('is_published', true)
        .in('merchant_id', activeMerchantIds)
        .order('rating', { ascending: false });

      if (city) query = query.ilike('city', `%${city}%`);
      if (category) query = query.ilike('category', `%${category}%`);
      if (search) query = query.or(`store_name.ilike.%${search}%,description.ilike.%${search}%`);
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ stores: data || [], total: count, limit, offset }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET ?action=store&merchant_id=X — Single store profile
    if (action === 'store') {
      const merchantId = url.searchParams.get('merchant_id');
      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: store, error } = await supabase.from('pos_store_profiles')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_published', true)
        .single();
      if (error || !store) {
        return new Response(JSON.stringify({ error: 'store_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get product count
      const { count: productCount } = await supabase.from('pos_products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      return new Response(JSON.stringify({ ...store, product_count: productCount || 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET ?action=products&merchant_id=X — Products for a published store
    if (action === 'products') {
      const merchantId = url.searchParams.get('merchant_id');
      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify store is published
      const { data: store } = await supabase.from('pos_store_profiles')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('is_published', true)
        .single();
      if (!store) {
        return new Response(JSON.stringify({ error: 'store_not_published' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const categoryFilter = url.searchParams.get('category_id');
      const search = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase.from('pos_products')
        .select('*, pos_product_variants(*), pos_product_images(*)', { count: 'exact' })
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('name');

      if (categoryFilter) query = query.eq('category_id', categoryFilter);
      if (search) query = query.ilike('name', `%${search}%`);
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ products: data, total: count, limit, offset }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', message: 'Use action=stores|store|products' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('pos-store-browse error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
