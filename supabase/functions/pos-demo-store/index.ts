import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

const DEMO_CATEGORIES = [
  { name: 'Food & Beverages', slug: 'food-beverages' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Fashion', slug: 'fashion' },
];

const DEMO_PRODUCTS = [
  { name: 'Ndolé Plate', description: 'Traditional Cameroonian ndolé with plantains and fish', category: 'food-beverages', variants: [{ name: 'Regular', price: 2500, sku: 'DEMO-NDOLE-R' }, { name: 'Large', price: 3500, sku: 'DEMO-NDOLE-L' }] },
  { name: 'Jollof Rice', description: 'Spicy jollof rice with grilled chicken', category: 'food-beverages', variants: [{ name: 'Standard', price: 2000, sku: 'DEMO-JOLLOF-S' }, { name: 'Premium', price: 3000, sku: 'DEMO-JOLLOF-P' }] },
  { name: 'Fresh Juice Combo', description: 'Mix of tropical fruit juices — mango, guava, pineapple', category: 'food-beverages', variants: [{ name: '500ml', price: 1000, sku: 'DEMO-JUICE-500' }, { name: '1L', price: 1800, sku: 'DEMO-JUICE-1L' }] },
  { name: 'Grilled Fish', description: 'Braised whole tilapia with pepper sauce', category: 'food-beverages', variants: [{ name: 'Medium', price: 3000, sku: 'DEMO-FISH-M' }, { name: 'Large', price: 5000, sku: 'DEMO-FISH-L' }] },
  { name: 'Phone Charger USB-C', description: 'Fast charging USB-C cable and adapter', category: 'electronics', variants: [{ name: '1m Cable', price: 3000, sku: 'DEMO-CHRG-1M' }, { name: '2m Cable + Adapter', price: 5500, sku: 'DEMO-CHRG-2M' }] },
  { name: 'Bluetooth Speaker', description: 'Portable wireless speaker with 8-hour battery', category: 'electronics', variants: [{ name: 'Mini', price: 8000, sku: 'DEMO-SPKR-MINI' }, { name: 'Pro', price: 15000, sku: 'DEMO-SPKR-PRO' }] },
  { name: 'LED Desk Lamp', description: 'Rechargeable LED lamp with 3 brightness levels', category: 'electronics', variants: [{ name: 'Standard', price: 5000, sku: 'DEMO-LAMP-S' }] },
  { name: 'Ankara Shirt', description: 'Handmade African print cotton shirt', category: 'fashion', variants: [{ name: 'S', price: 8000, sku: 'DEMO-ANKR-S' }, { name: 'M', price: 8000, sku: 'DEMO-ANKR-M' }, { name: 'L', price: 8500, sku: 'DEMO-ANKR-L' }] },
  { name: 'Leather Sandals', description: 'Handcrafted genuine leather sandals', category: 'fashion', variants: [{ name: 'Size 40', price: 6000, sku: 'DEMO-SNDL-40' }, { name: 'Size 42', price: 6000, sku: 'DEMO-SNDL-42' }, { name: 'Size 44', price: 6500, sku: 'DEMO-SNDL-44' }] },
  { name: 'Woven Tote Bag', description: 'Traditional hand-woven tote bag', category: 'fashion', variants: [{ name: 'Small', price: 4000, sku: 'DEMO-TOTE-S' }, { name: 'Large', price: 7000, sku: 'DEMO-TOTE-L' }] },
];

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

    const body = await req.json();
    const { action, merchant_id } = body;

    if (!merchant_id) {
      return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify merchant ownership
    const { data: merchant } = await supabase.from('gateway_merchants')
      .select('id, business_name').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) {
      return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset') {
      return await handleReset(supabase, merchant_id);
    }

    if (action === 'create') {
      return await handleCreate(supabase, merchant_id, merchant.business_name);
    }

    return new Response(JSON.stringify({ error: 'invalid_action', message: 'Use action=create|reset' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('pos-demo-store error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleReset(supabase: any, merchantId: string) {
  // Delete all demo data in correct FK order
  // 1. Delete inventory movements for this merchant's demo products
  await supabase.from('pos_inventory_movements').delete().eq('merchant_id', merchantId);
  await supabase.from('pos_inventory_items').delete().eq('merchant_id', merchantId);

  // 2. Delete order-related data
  const { data: orders } = await supabase.from('pos_orders').select('id').eq('merchant_id', merchantId);
  const orderIds = (orders || []).map((o: any) => o.id);
  if (orderIds.length > 0) {
    // Delete return items → returns → order status history → order payments → order items → orders
    const { data: returns } = await supabase.from('pos_returns').select('id').in('order_id', orderIds);
    const returnIds = (returns || []).map((r: any) => r.id);
    if (returnIds.length > 0) {
      await supabase.from('pos_return_items').delete().in('return_id', returnIds);
    }
    await supabase.from('pos_returns').delete().in('order_id', orderIds);
    await supabase.from('pos_order_status_history').delete().in('order_id', orderIds);
    await supabase.from('pos_order_payments').delete().in('order_id', orderIds);
    await supabase.from('pos_order_items').delete().in('order_id', orderIds);
    await supabase.from('pos_orders').delete().eq('merchant_id', merchantId);
  }

  // 3. Delete consumer carts for this merchant
  const { data: carts } = await supabase.from('pos_consumer_carts').select('id').eq('merchant_id', merchantId);
  const cartIds = (carts || []).map((c: any) => c.id);
  if (cartIds.length > 0) {
    await supabase.from('pos_consumer_cart_items').delete().in('cart_id', cartIds);
  }
  await supabase.from('pos_consumer_carts').delete().eq('merchant_id', merchantId);

  // 4. Delete products chain: category links → images → variants → products
  const { data: products } = await supabase.from('pos_products').select('id').eq('merchant_id', merchantId);
  const productIds = (products || []).map((p: any) => p.id);
  if (productIds.length > 0) {
    await supabase.from('pos_product_category_links').delete().in('product_id', productIds);
    await supabase.from('pos_product_images').delete().in('product_id', productIds);
  }
  await supabase.from('pos_product_variants').delete().eq('merchant_id', merchantId);
  await supabase.from('pos_products').delete().eq('merchant_id', merchantId);

  // 5. Delete categories
  await supabase.from('pos_categories').delete().eq('merchant_id', merchantId);

  // 6. Delete integration mappings & sync runs (not the integration itself)
  const { data: integrations } = await supabase.from('merchant_integrations').select('id').eq('merchant_id', merchantId);
  const intIds = (integrations || []).map((i: any) => i.id);
  if (intIds.length > 0) {
    await supabase.from('integration_mappings').delete().in('integration_id', intIds);
    await supabase.from('integration_sync_runs').delete().in('integration_id', intIds);
    await supabase.from('integration_events_inbox').delete().in('integration_id', intIds);
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'All POS demo data has been reset',
    deleted: {
      products: productIds?.length || 0,
      orders: orderIds?.length || 0,
      carts: cartIds?.length || 0,
    },
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCreate(supabase: any, merchantId: string, businessName: string) {
  const stats = { categories: 0, products: 0, variants: 0, inventory_items: 0 };

  // 1. Ensure a default location exists
  let { data: location } = await supabase.from('merchant_locations')
    .select('id').eq('merchant_id', merchantId).limit(1).maybeSingle();

  if (!location) {
    const { data: newLoc } = await supabase.from('merchant_locations').insert({
      merchant_id: merchantId,
      name: 'Main Store',
      address_json: { street: 'Avenue de la Liberté', city: 'Douala' },
      city: 'Douala',
      country: 'CM',
      timezone: 'Africa/Douala',
      currency_default: 'XAF',
    }).select('id').single();
    location = newLoc;
  }

  // 2. Create categories
  const categoryMap: Record<string, string> = {};
  for (const cat of DEMO_CATEGORIES) {
    const { data } = await supabase.from('pos_categories').insert({
      merchant_id: merchantId, name: cat.name, slug: cat.slug,
    }).select('id').single();
    if (data) {
      categoryMap[cat.slug] = data.id;
      stats.categories++;
    }
  }

  // 3. Create products with variants and inventory
  for (const prod of DEMO_PRODUCTS) {
    const { data: product } = await supabase.from('pos_products').insert({
      merchant_id: merchantId,
      name: prod.name,
      description: prod.description,
      currency: 'XAF',
      status: 'active',
      source: 'manual',
    }).select('id').single();

    if (!product) continue;
    stats.products++;

    // Link category
    const catId = categoryMap[prod.category];
    if (catId) {
      await supabase.from('pos_product_category_links').insert({
        product_id: product.id, category_id: catId,
      });
    }

    // Create variants with inventory
    for (const v of prod.variants) {
      const { data: variant } = await supabase.from('pos_product_variants').insert({
        product_id: product.id,
        merchant_id: merchantId,
        name: v.name,
        sku: v.sku,
        price: v.price,
        track_inventory: true,
      }).select('id').single();

      if (!variant) continue;
      stats.variants++;

      // Seed inventory (random 10-50 units)
      if (location) {
        const qty = Math.floor(Math.random() * 41) + 10;
        await supabase.rpc('pos_adjust_inventory', {
          _merchant_id: merchantId,
          _variant_id: variant.id,
          _location_id: location.id,
          _quantity_delta: qty,
          _type: 'manual_adjust',
          _reason: 'Demo store initial stock',
        });
        stats.inventory_items++;
      }
    }
  }

  // 4. Ensure store profile exists
  const { data: existingProfile } = await supabase.from('pos_store_profiles')
    .select('id').eq('merchant_id', merchantId).maybeSingle();

  if (!existingProfile) {
    await supabase.from('pos_store_profiles').insert({
      merchant_id: merchantId,
      store_name: `${businessName} Demo Store`,
      description: 'This is a demo store with sample products for testing the KOB POS system.',
      category: 'General Store',
      city: 'Douala',
      country: 'CM',
      currency: 'XAF',
      is_published: false,
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Demo store created with sample products and inventory',
    stats,
    location_id: location?.id,
  }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
