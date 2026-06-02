// Daily Needs — External Shipping Provider Webhook (Phase 7)
// Receives status callbacks from external delivery providers (Glovo, Uber Direct,
// Yango, etc.) and mirrors them into our order state machine.
//
// Public endpoint — verified via shared secret + tracking-id lookup.
// Idempotent: status updates are applied only when the order is in a state
// downstream of the callback's mapped target.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shipping-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  tracking_id: z.string().min(1),
  status: z.enum(["accepted", "picked_up", "on_the_way", "arriving", "delivered", "cancelled"]),
  driver_name: z.string().optional(),
  driver_phone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  eta_minutes: z.number().int().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map external provider status → our dn_order_status state machine.
// Note: "delivered" via provider callback intentionally maps to "arriving" —
// final delivery confirmation still requires the 4-digit customer code.
const STATUS_MAP: Record<string, string> = {
  accepted: "ready",
  picked_up: "picked_up",
  on_the_way: "on_the_way",
  arriving: "arriving",
  delivered: "arriving",
  cancelled: "cancelled",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expected = Deno.env.get("DN_SHIPPING_WEBHOOK_SECRET");
  const got = req.headers.get("x-shipping-signature");
  if (expected && got !== expected) return json(401, { error: "invalid_signature" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const { tracking_id, status, latitude, longitude, eta_minutes } = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: assignment } = await supabase
    .from("daily_needs_delivery_assignments")
    .select("id, order_id, status")
    .eq("external_tracking_id", tracking_id)
    .maybeSingle();
  if (!assignment) return json(404, { error: "tracking_not_found" });

  const patch: Record<string, unknown> = { status };
  if (typeof latitude === "number") patch.current_latitude = latitude;
  if (typeof longitude === "number") patch.current_longitude = longitude;
  if (typeof eta_minutes === "number") patch.estimated_eta_minutes = eta_minutes;
  if (status === "picked_up") patch.picked_up_at = new Date().toISOString();
  await supabase.from("daily_needs_delivery_assignments").update(patch).eq("id", assignment.id);

  const target = STATUS_MAP[status];
  if (target) {
    await supabase
      .from("daily_needs_orders")
      .update({ status: target })
      .eq("id", assignment.order_id)
      .in("status", ["ready", "picked_up", "on_the_way"]);
    await supabase.from("daily_needs_order_status_history").insert({
      order_id: assignment.order_id, status: target,
      reason: `shipping_provider_callback:${status}`,
    });
  }

  return json(200, { ok: true, mirrored_status: target });
});
