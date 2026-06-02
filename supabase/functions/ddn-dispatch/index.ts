// DDN — Create/dispatch a delivery assignment for a Daily Needs order.
// Idempotent. Honors merchant settings: max_radius_km, surge_multiplier,
// min/max fee overrides, operating hours.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { notifyUser, getMerchantOwnerId } from "../_shared/ddn-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({ order_id: z.string().regex(UUID), offer_ttl_seconds: z.number().int().min(15).max(300).optional() });
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function withinOperatingHours(hours: any, accept_outside: boolean): boolean {
  if (accept_outside) return true;
  if (!hours || typeof hours !== "object") return true;
  const now = new Date();
  const key = DAY_KEYS[now.getUTCDay()];
  const slot = hours[key];
  if (!slot || !slot.open || !slot.close) return false;
  const cur = now.getUTCHours().toString().padStart(2, "0") + ":" + now.getUTCMinutes().toString().padStart(2, "0");
  return slot.open <= cur && cur < slot.close;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json(401, { error: "unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const { order_id, offer_ttl_seconds = 45 } = parsed.data;

  // Idempotent
  const { data: existing } = await sb.from("ddn_assignments").select("*").eq("order_id", order_id).maybeSingle();
  if (existing) return json(200, { ok: true, replay: true, assignment: existing });

  const { data: order, error: oErr } = await sb
    .from("daily_needs_orders")
    .select("id, status, total_xaf, delivery_latitude, delivery_longitude, daily_needs_stores!inner(id, merchant_id, latitude, longitude)")
    .eq("id", order_id).maybeSingle();
  if (oErr || !order) return json(404, { error: "order_not_found" });
  if (!["ready", "preparing"].includes(String((order as any).status))) {
    return json(409, { error: "invalid_order_status", current: (order as any).status, required: "ready" });
  }
  const store: any = order.daily_needs_stores;

  // Merchant fee settings (advanced fulfillment rules)
  const { data: settings } = await sb
    .from("ddn_merchant_delivery_settings").select("*")
    .eq("merchant_id", store.merchant_id).maybeSingle();
  const s: any = settings ?? {};

  // Operating hours gate
  if (!withinOperatingHours(s.operating_hours, !!s.accept_outside_hours)) {
    return json(409, { error: "outside_operating_hours" });
  }

  const base = s.base_fee_xaf ?? 500;
  const perKm = s.per_km_fee_xaf ?? 100;
  const pctFee = Number(s.platform_fee_pct ?? 15);
  const minFee = s.min_fee_xaf ?? 0;
  const maxFee = s.max_fee_xaf ?? null;
  const surge = Number(s.surge_multiplier ?? 1);
  const maxRadius = Number(s.max_radius_km ?? 15);

  const dist = haversine(Number(store.latitude), Number(store.longitude), Number((order as any).delivery_latitude), Number((order as any).delivery_longitude));
  const distance_km = Number.isFinite(dist) ? Math.round(dist * 100) / 100 : null;

  if (distance_km != null && distance_km > maxRadius) {
    return json(409, { error: "outside_max_radius", distance_km, max_radius_km: maxRadius });
  }

  let delivery_fee_xaf = distance_km != null ? Math.round((base + perKm * distance_km) * surge) : Math.round(base * surge);
  if (minFee > 0) delivery_fee_xaf = Math.max(minFee, delivery_fee_xaf);
  if (maxFee != null) delivery_fee_xaf = Math.min(maxFee, delivery_fee_xaf);
  const platform_fee_xaf = Math.round((delivery_fee_xaf * pctFee) / 100);
  const driver_earnings_xaf = delivery_fee_xaf - platform_fee_xaf;
  const eta_min = distance_km != null ? Math.max(10, Math.round((distance_km / 25) * 60) + (s.prep_time_min ?? 15)) : 30;

  const { data: created, error: cErr } = await sb.from("ddn_assignments").insert({
    order_id,
    merchant_id: store.merchant_id,
    status: "pending",
    pickup_lat: Number(store.latitude) || null,
    pickup_lng: Number(store.longitude) || null,
    drop_lat: Number((order as any).delivery_latitude) || null,
    drop_lng: Number((order as any).delivery_longitude) || null,
    distance_km, eta_min, delivery_fee_xaf, platform_fee_xaf, driver_earnings_xaf,
  }).select().single();
  if (cErr) return json(500, { error: "assignment_failed", details: cErr.message });

  // Notify merchant: order dispatched / awaiting driver
  const merchantUser = await getMerchantOwnerId(sb, store.merchant_id);
  if (merchantUser) {
    await notifyUser(sb, {
      user_id: merchantUser,
      type: "ddn.assignment.created",
      title: "Delivery dispatched",
      message: `An order is being matched to a driver (${delivery_fee_xaf.toLocaleString()} XAF).`,
      icon: "truck",
      metadata: { assignment_id: created.id, order_id, distance_km, delivery_fee_xaf },
      idempotency_key: `ddn.created:${created.id}`,
    });
  }

  const { data: driverId } = await sb.rpc("ddn_find_best_driver", { _assignment_id: created.id, _max_radius_km: maxRadius });
  if (driverId) {
    const expires = new Date(Date.now() + offer_ttl_seconds * 1000).toISOString();
    await sb.from("ddn_assignment_offers").insert({ assignment_id: created.id, driver_id: driverId, expires_at: expires });
    await sb.from("ddn_assignments").update({ status: "offered" }).eq("id", created.id);
    return json(200, { ok: true, assignment: { ...created, status: "offered" }, offered_to: driverId, expires_at: expires });
  }

  return json(200, { ok: true, assignment: created, offered_to: null, note: "no_driver_available_yet" });
});

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return NaN;
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
