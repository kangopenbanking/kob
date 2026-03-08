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

    if (req.method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');
      const locationId = url.searchParams.get('location_id');
      const search = url.searchParams.get('search');

      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let query = supabase.from('pos_inventory_items')
        .select('*, pos_product_variants!inner(name, sku, barcode, price, pos_products!inner(name, status))', { count: 'exact' })
        .eq('merchant_id', merchantId);

      if (locationId) query = query.eq('location_id', locationId);
      if (search) query = query.or(`pos_product_variants.sku.ilike.%${search}%,pos_product_variants.name.ilike.%${search}%`);

      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ inventory: data, total: count, limit, offset }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { merchant_id, variant_id, location_id, quantity_delta, reason, type } = body;

      if (!merchant_id || !variant_id || !location_id || quantity_delta === undefined) {
        return new Response(JSON.stringify({ error: 'merchant_id, variant_id, location_id, quantity_delta required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) {
        return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: result, error } = await supabase.rpc('pos_adjust_inventory', {
        _merchant_id: merchant_id,
        _variant_id: variant_id,
        _location_id: location_id,
        _quantity_delta: quantity_delta,
        _type: type || 'manual_adjust',
        _reason: reason || null,
      });

      if (error) throw error;

      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-inventory error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
