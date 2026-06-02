// Daily Needs — Order Transition
// State machine enforced server-side. Records immutable history.
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
  to_status: z.enum([
    "accepted","preparing","ready","picked_up","on_the_way","arriving","delivered","cancelled","refunded",
  ]),
  delivery_code: z.string().length(4).optional(),
  reason: z.string().max(500).optional(),
});

// Allowed transitions
const ALLOWED: Record<string, string[]> = {
  received:    ["accepted", "cancelled"],
  accepted:    ["preparing", "cancelled"],
  preparing:   ["ready", "cancelled"],
  ready:       ["picked_up", "cancelled"],
  picked_up:   ["on_the_way"],
  on_the_way:  ["arriving", "delivered"],
  arriving:    ["delivered"],
  delivered:   ["refunded"],
  cancelled:   [],
  refunded:    [],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json(401, { error: "unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const { order_id, to_status, delivery_code, reason } = parsed.data;

  const { data: order } = await supabase
    .from("daily_needs_orders")
    .select("*, daily_needs_stores!inner(merchant_id)")
    .eq("id", order_id)
    .maybeSingle();
  if (!order) return json(404, { error: "order_not_found" });

  const from = order.status as string;
  if (!ALLOWED[from]?.includes(to_status)) {
    return json(409, { error: "transition_not_allowed", from, to: to_status });
  }

  // Delivery confirmation requires correct 4-digit code from customer
  if (to_status === "delivered") {
    if (!delivery_code || delivery_code !== order.delivery_code) {
      return json(403, { error: "invalid_delivery_code" });
    }
  }

  const patch: Record<string, unknown> = { status: to_status };
  if (to_status === "delivered") patch.delivered_at = new Date().toISOString();

  const { error: uErr } = await supabase.from("daily_needs_orders").update(patch).eq("id", order_id);
  if (uErr) return json(500, { error: "update_failed", details: uErr.message });

  // Phase 6: escrow settlement
  let escrow: unknown = null;
  if (to_status === "delivered") {
    const { data, error } = await supabase.rpc("dn_escrow_release", { _order_id: order_id });
    if (error) return json(500, { error: "escrow_release_failed", details: error.message });
    escrow = data;
  } else if (to_status === "cancelled" || to_status === "refunded") {
    const { data, error } = await supabase.rpc("dn_escrow_refund", { _order_id: order_id });
    if (error) return json(500, { error: "escrow_refund_failed", details: error.message });
    escrow = data;
  }

  // Phase 7: auto-assign driver / shipping provider when ready for pickup
  let assignment: unknown = null;
  if (to_status === "ready") {
    try {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/daily-needs-assign-driver`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": auth,
            "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          },
          body: JSON.stringify({ order_id }),
        },
      );
      assignment = await res.json().catch(() => null);
    } catch (e) {
      assignment = { error: "assign_failed", details: (e as Error).message };
    }
  }

  await supabase.from("daily_needs_order_status_history").insert({
    order_id, status: to_status, changed_by: user.id, reason: reason ?? null,
  });

  return json(200, { ok: true, from, to: to_status, escrow, assignment });
});
