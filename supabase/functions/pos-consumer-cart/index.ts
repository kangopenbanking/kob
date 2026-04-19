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

    // GET: Fetch active cart with items
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const merchantId = url.searchParams.get('merchant_id');

      let query = supabase.from('pos_consumer_carts')
        .select('*, pos_consumer_cart_items(*, pos_product_variants(id, name, sku, price, product_id, pos_products(name, pos_product_images(image_url))))')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (merchantId) query = query.eq('merchant_id', merchantId);
      query = query.order('created_at', { ascending: false }).limit(1);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      return new Response(JSON.stringify({ cart: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST: Cart operations
    if (req.method === 'POST') {
      const body = await req.json();
      const { action, merchant_id, variant_id, quantity, cart_id } = body;

      // Validate UUID format for any provided IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (merchant_id && !uuidRegex.test(merchant_id)) {
        return new Response(JSON.stringify({ error: 'invalid_merchant_id', message: 'merchant_id must be a valid UUID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (variant_id && !uuidRegex.test(variant_id)) {
        return new Response(JSON.stringify({ error: 'invalid_variant_id', message: 'variant_id must be a valid UUID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (cart_id && !uuidRegex.test(cart_id)) {
        return new Response(JSON.stringify({ error: 'invalid_cart_id', message: 'cart_id must be a valid UUID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (body.item_id && !uuidRegex.test(body.item_id)) {
        return new Response(JSON.stringify({ error: 'invalid_item_id', message: 'item_id must be a valid UUID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'add') {
        if (!merchant_id || !variant_id) {
          return new Response(JSON.stringify({ error: 'merchant_id and variant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Verify merchant exists before creating cart
        const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).maybeSingle();
        if (!merchant) {
          return new Response(JSON.stringify({ error: 'merchant_not_found', message: 'Merchant does not exist' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get or create active cart for this merchant
        let { data: cart } = await supabase.from('pos_consumer_carts')
          .select('id')
          .eq('user_id', user.id)
          .eq('merchant_id', merchant_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!cart) {
          const { data: newCart, error: cartErr } = await supabase.from('pos_consumer_carts')
            .insert({ user_id: user.id, merchant_id, status: 'active' })
            .select('id')
            .single();
          if (cartErr) throw cartErr;
          cart = newCart;
        }

        // Get variant price
        const { data: variant } = await supabase.from('pos_product_variants')
          .select('price').eq('id', variant_id).single();
        if (!variant) {
          return new Response(JSON.stringify({ error: 'variant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Check if item already in cart
        const { data: existing } = await supabase.from('pos_consumer_cart_items')
          .select('id, quantity')
          .eq('cart_id', cart.id)
          .eq('variant_id', variant_id)
          .maybeSingle();

        if (existing) {
          const newQty = existing.quantity + (quantity || 1);
          await supabase.from('pos_consumer_cart_items')
            .update({ quantity: newQty })
            .eq('id', existing.id);
        } else {
          await supabase.from('pos_consumer_cart_items')
            .insert({ cart_id: cart.id, variant_id, quantity: quantity || 1, unit_price: variant.price });
        }

        // Return updated cart
        const { data: updatedCart } = await supabase.from('pos_consumer_carts')
          .select('*, pos_consumer_cart_items(*, pos_product_variants(id, name, sku, price, pos_products(name)))')
          .eq('id', cart.id)
          .single();

        return new Response(JSON.stringify({ cart: updatedCart }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'update_quantity') {
        const itemId = body.item_id;
        if (!itemId || quantity === undefined) {
          return new Response(JSON.stringify({ error: 'item_id and quantity required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (quantity <= 0) {
          await supabase.from('pos_consumer_cart_items').delete().eq('id', itemId);
        } else {
          await supabase.from('pos_consumer_cart_items').update({ quantity }).eq('id', itemId);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'remove') {
        const itemId = body.item_id;
        if (!itemId) {
          return new Response(JSON.stringify({ error: 'item_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await supabase.from('pos_consumer_cart_items').delete().eq('id', itemId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'clear') {
        const targetCartId = cart_id || body.cart_id;
        if (!targetCartId) {
          return new Response(JSON.stringify({ error: 'cart_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await supabase.from('pos_consumer_cart_items').delete().eq('cart_id', targetCartId);
        await supabase.from('pos_consumer_carts').update({ status: 'abandoned' }).eq('id', targetCartId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'set_shipping') {
        const targetCartId = cart_id || body.cart_id;
        if (!targetCartId) {
          return new Response(JSON.stringify({ error: 'cart_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const shipping = body.shipping || {};
        const update: Record<string, unknown> = {
          shipping_recipient_name: shipping.recipient_name ?? null,
          shipping_phone: shipping.phone ?? null,
          shipping_address_line: shipping.address_line ?? null,
          shipping_city: shipping.city ?? null,
          shipping_region: shipping.region ?? null,
          shipping_country: shipping.country ?? 'CM',
          shipping_postal_code: shipping.postal_code ?? null,
          delivery_notes: shipping.delivery_notes ?? null,
          shipping_fee: typeof shipping.shipping_fee === 'number' ? shipping.shipping_fee : 0,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('pos_consumer_carts').update(update).eq('id', targetCartId).eq('user_id', user.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'invalid_action', message: 'Use action=add|update_quantity|remove|clear|set_shipping' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-consumer-cart error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
