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

    if (req.method === 'POST') {
      const body = await req.json();
      const { merchant_id, name, description, currency, tax_class, source, variants, category_ids } = body;

      if (!merchant_id || !name) {
        return new Response(JSON.stringify({ error: 'merchant_id and name are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) {
        return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create product
      const { data: product, error: prodErr } = await supabase.from('pos_products').insert({
        merchant_id, name, description,
        currency: currency || 'XAF',
        tax_class: tax_class || null,
        source: source || 'manual',
        status: 'active',
      }).select().single();

      if (prodErr) throw prodErr;

      // Create variants
      const createdVariants = [];
      const variantList = variants && variants.length > 0 ? variants : [{ name: 'Default', price: 0 }];
      for (const v of variantList) {
        const { data: variant, error: varErr } = await supabase.from('pos_product_variants').insert({
          product_id: product.id,
          merchant_id,
          sku: v.sku || null,
          barcode: v.barcode || null,
          name: v.name || 'Default',
          attributes_json: v.attributes || {},
          price: v.price || 0,
          compare_at_price: v.compare_at_price || null,
          cost_price: v.cost_price || null,
          track_inventory: v.track_inventory !== false,
        }).select().single();
        if (varErr) throw varErr;
        createdVariants.push(variant);
      }

      // Link categories
      if (category_ids && category_ids.length > 0) {
        const links = category_ids.map((cid: string) => ({ product_id: product.id, category_id: cid }));
        await supabase.from('pos_product_category_links').insert(links);
      }

      return new Response(JSON.stringify({ ...product, variants: createdVariants }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');
      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let query = supabase.from('pos_products')
        .select('*, pos_product_variants(*)', { count: 'exact' })
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      const search = url.searchParams.get('search');
      if (search) query = query.ilike('name', `%${search}%`);
      const source = url.searchParams.get('source');
      if (source) query = query.eq('source', source);
      const status = url.searchParams.get('status');
      if (status) query = query.eq('status', status);

      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ products: data, total: count, limit, offset }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'PATCH') {
      const body = await req.json();
      const { product_id, merchant_id, ...updates } = body;
      if (!product_id || !merchant_id) {
        return new Response(JSON.stringify({ error: 'product_id and merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase.from('pos_products')
        .update(updates)
        .eq('id', product_id)
        .eq('merchant_id', merchant_id)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-catalog-products error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
