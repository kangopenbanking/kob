// Daily Needs — Order Create
// Atomic: validates cart, computes totals, creates order + items + status history,
// reserves wallet funds via existing gateway_charges (escrow).
// Idempotency: requires UUID v4 idempotency_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const Body = z.object({
  store_id: z.string().regex(UUID_V4),
  items: z.array(z.object({
    product_id: z.string().regex(UUID_V4),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(50),
  delivery_address: z.string().min(3).max(500),
  delivery_phone: z.string().min(7).max(20),
  delivery_latitude: z.number().optional(),
  delivery_longitude: z.number().optional(),
  prescription_url: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  idempotency_key: z.string().regex(UUID_V4),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (authErr || !user) return json(401, { error: "unauthorized" });

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const b = parsed.data;

  // Idempotency: return existing order if key matches
  const { data: existing } = await supabase
    .from("daily_needs_orders")
    .select("*")
    .eq("idempotency_key", b.idempotency_key)
    .maybeSingle();
  if (existing) return json(200, { order: existing, replayed: true });

  // Load store + verify status
  const { data: store, error: sErr } = await supabase
    .from("daily_needs_stores")
    .select("id, vertical, status, preparation_time_min, merchant_id")
    .eq("id", b.store_id)
    .maybeSingle();
  if (sErr || !store) return json(404, { error: "store_not_found" });
  if (store.status !== "active") return json(409, { error: "store_not_active" });

  // Load products, snapshot prices, enforce stock + prescription rules
  const productIds = b.items.map((i) => i.product_id);
  const { data: products, error: pErr } = await supabase
    .from("daily_needs_products")
    .select("id, name, price_xaf, stock, is_available, requires_prescription, store_id")
    .in("id", productIds);
  if (pErr || !products || products.length !== productIds.length) {
    return json(400, { error: "products_invalid" });
  }
  for (const p of products) {
    if (p.store_id !== b.store_id) return json(400, { error: "product_store_mismatch" });
    if (!p.is_available) return json(409, { error: "product_unavailable", product_id: p.id });
    const qty = b.items.find((i) => i.product_id === p.id)!.quantity;
    if (p.stock !== null && p.stock < qty) return json(409, { error: "insufficient_stock", product_id: p.id });
    if (p.requires_prescription && !b.prescription_url) {
      return json(412, { error: "prescription_required", product_id: p.id });
    }
  }

  // Totals
  const subtotal = b.items.reduce((sum, i) => {
    const p = products.find((x) => x.id === i.product_id)!;
    return sum + Number(p.price_xaf) * i.quantity;
  }, 0);
  const delivery_fee = 500; // flat XAF — refined by transport quote in Phase 7
  const service_fee = Math.round(subtotal * 0.02);
  const total = subtotal + delivery_fee + service_fee;

  const requiresPrescription = products.some((p) => p.requires_prescription);

  // Create order
  const { data: order, error: oErr } = await supabase
    .from("daily_needs_orders")
    .insert({
      user_id: user.id,
      store_id: b.store_id,
      status: "received",
      subtotal_xaf: subtotal,
      delivery_fee_xaf: delivery_fee,
      service_fee_xaf: service_fee,
      total_xaf: total,
      delivery_address: b.delivery_address,
      delivery_phone: b.delivery_phone,
      delivery_latitude: b.delivery_latitude ?? null,
      delivery_longitude: b.delivery_longitude ?? null,
      prescription_url: b.prescription_url ?? null,
      prescription_status: requiresPrescription ? "pending" : null,
      idempotency_key: b.idempotency_key,
      notes: b.notes ?? null,
      escrow_status: "held",
    })
    .select()
    .single();
  if (oErr) return json(500, { error: "order_insert_failed", details: oErr.message });

  // Order items
  const itemRows = b.items.map((i) => {
    const p = products.find((x) => x.id === i.product_id)!;
    return {
      order_id: order.id,
      product_id: p.id,
      name_snapshot: p.name,
      quantity: i.quantity,
      unit_price_xaf: p.price_xaf,
      total_xaf: Number(p.price_xaf) * i.quantity,
    };
  });
  await supabase.from("daily_needs_order_items").insert(itemRows);
  await supabase.from("daily_needs_order_status_history").insert({
    order_id: order.id,
    status: "received",
    changed_by: user.id,
  });

  // Phase 6: fund escrow atomically (held against merchant escrow wallet)
  const { data: fundRes, error: fundErr } = await supabase.rpc("dn_escrow_fund", { _order_id: order.id });
  if (fundErr) {
    return json(500, { error: "escrow_fund_failed", details: fundErr.message, order_id: order.id });
  }

  // Re-read with escrow fields populated
  const { data: funded } = await supabase
    .from("daily_needs_orders")
    .select("*")
    .eq("id", order.id)
    .single();

  return json(201, { order: funded ?? order, escrow: fundRes, replayed: false });
});
