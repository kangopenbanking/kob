// Daily Needs — Driver / Shipping Provider Assignment (Phase 7)
// Strategy: try nearest internal driver first; fall back to configured external
// shipping provider (Glovo / Uber Direct / Yango adapter stub).
//
// Triggered automatically by daily-needs-order-transition when an order moves
// to "ready". Can also be called manually by merchants/admins to (re)assign.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z.object({
  order_id: z.string().regex(UUID_V4),
  prefer_provider: z.enum(["internal", "external"]).optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- External shipping provider adapter -------------------------------------
// Pluggable: switch on DN_SHIPPING_PROVIDER env. Each adapter creates a delivery
// task with the external service and returns a tracking id. Stubs return a
// synthetic tracking id when no API key is configured (dev / sandbox mode).
type DispatchInput = {
  pickup: { lat: number; lon: number; address: string; contact: string };
  dropoff: { lat: number; lon: number; address: string; contact: string };
  order_ref: string;
  amount_xaf: number;
};
type DispatchResult = {
  provider: string;
  tracking_id: string;
  eta_minutes: number;
  fee_xaf: number;
};

async function dispatchExternal(input: DispatchInput): Promise<DispatchResult> {
  const provider = Deno.env.get("DN_SHIPPING_PROVIDER") ?? "stub";
  const apiKey = Deno.env.get("DN_SHIPPING_API_KEY");
  const baseUrl = Deno.env.get("DN_SHIPPING_BASE_URL");

  if (!apiKey || !baseUrl) {
    // Sandbox / no-key mode: synthetic tracking id, ETA based on straight-line distance.
    return {
      provider,
      tracking_id: `sbx_${crypto.randomUUID()}`,
      eta_minutes: 30,
      fee_xaf: 1000,
    };
  }

  // Generic REST shape — adapter contract documented in docs/daily-needs/.
  const res = await fetch(`${baseUrl}/deliveries`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      external_reference: input.order_ref,
      pickup: input.pickup,
      dropoff: input.dropoff,
      order_value: input.amount_xaf,
      currency: "XAF",
    }),
  });
  if (!res.ok) {
    throw new Error(`shipping_provider_${provider}_${res.status}`);
  }
  const data = await res.json();
  return {
    provider,
    tracking_id: String(data.id ?? data.tracking_id ?? crypto.randomUUID()),
    eta_minutes: Number(data.eta_minutes ?? 45),
    fee_xaf: Number(data.fee ?? 1000),
  };
}
// ----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json(401, { error: "unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const { order_id, prefer_provider } = parsed.data;

  // Load order + store coords
  const { data: order, error: oErr } = await supabase
    .from("daily_needs_orders")
    .select("id, status, total_xaf, delivery_address, delivery_latitude, delivery_longitude, daily_needs_stores!inner(id, name, address, latitude, longitude, merchant_id)")
    .eq("id", order_id)
    .maybeSingle();
  if (oErr || !order) return json(404, { error: "order_not_found" });
  const store: any = order.daily_needs_stores;

  // Idempotent: if already assigned, return existing row
  const { data: existing } = await supabase
    .from("daily_needs_delivery_assignments")
    .select("*").eq("order_id", order_id).maybeSingle();
  if (existing) return json(200, { ok: true, replay: true, assignment: existing });

  // Need pickup + dropoff coords
  const pickupLat = Number(store.latitude);
  const pickupLon = Number(store.longitude);
  const dropLat = Number((order as any).delivery_latitude);
  const dropLon = Number((order as any).delivery_longitude);

  let assignment: Record<string, unknown> = {
    order_id,
    pickup_address: store.address ?? null,
    dropoff_address: (order as any).delivery_address ?? null,
    pickup_latitude: Number.isFinite(pickupLat) ? pickupLat : null,
    pickup_longitude: Number.isFinite(pickupLon) ? pickupLon : null,
    dropoff_latitude: Number.isFinite(dropLat) ? dropLat : null,
    dropoff_longitude: Number.isFinite(dropLon) ? dropLon : null,
    status: "assigned",
  };

  // 1) Try internal driver (unless caller forced external)
  let usedProvider: "internal" | "external" = "internal";
  if (prefer_provider !== "external" && Number.isFinite(pickupLat) && Number.isFinite(pickupLon)) {
    const { data: nearest } = await supabase.rpc("dn_find_nearest_driver", {
      _lat: pickupLat, _lon: pickupLon, _radius_km: 15,
    });
    const row = Array.isArray(nearest) ? nearest[0] : nearest;
    if (row?.user_id) {
      assignment.provider = "internal";
      assignment.driver_id = row.user_id;
      assignment.estimated_distance_km = row.distance_km ?? null;
      assignment.estimated_eta_minutes = Math.max(10, Math.round((Number(row.distance_km) || 5) * 4));
    } else {
      usedProvider = "external";
    }
  } else {
    usedProvider = "external";
  }

  // 2) External provider fallback
  if (usedProvider === "external") {
    try {
      const ext = await dispatchExternal({
        pickup: { lat: pickupLat || 0, lon: pickupLon || 0, address: store.address ?? "", contact: store.name ?? "" },
        dropoff: { lat: dropLat || 0, lon: dropLon || 0, address: (order as any).delivery_address ?? "", contact: "" },
        order_ref: order_id,
        amount_xaf: Number((order as any).total_xaf ?? 0),
      });
      assignment.provider = "external";
      assignment.external_provider = ext.provider;
      assignment.external_tracking_id = ext.tracking_id;
      assignment.estimated_eta_minutes = ext.eta_minutes;
    } catch (e) {
      return json(502, { error: "no_provider_available", details: (e as Error).message });
    }
  }

  const { data: created, error: cErr } = await supabase
    .from("daily_needs_delivery_assignments")
    .insert(assignment).select().single();
  if (cErr) return json(500, { error: "assignment_failed", details: cErr.message });

  return json(200, { ok: true, assignment: created });
});
