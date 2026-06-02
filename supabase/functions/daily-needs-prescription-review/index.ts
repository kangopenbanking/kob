// Daily Needs — Prescription Review (pharmacist approve/reject)
// Only pharmacy merchants of the owning store or admins can review.
// Approving an order auto-advances status to 'accepted' if currently 'received'.
// Rejecting marks the order 'cancelled' and flips escrow to 'refunded'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i;

const Body = z.object({
  order_id: z.string().regex(UUID_V4),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().max(500).optional(),
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

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const { order_id, decision, notes } = parsed.data;

  // Authorize: caller must own the pharmacy store, or be admin
  const { data: order, error: oErr } = await supabase
    .from("daily_needs_orders")
    .select("id, status, store_id, prescription_url, prescription_status, escrow_status")
    .eq("id", order_id)
    .maybeSingle();
  if (oErr || !order) return json(404, { error: "order_not_found" });
  if (!order.prescription_url) return json(412, { error: "no_prescription_attached" });
  if (order.prescription_status === "approved" || order.prescription_status === "rejected") {
    return json(409, { error: "already_reviewed", status: order.prescription_status });
  }

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  let allowed = !!isAdmin;
  if (!allowed) {
    const { data: store } = await supabase
      .from("daily_needs_stores")
      .select("vertical, merchant_id, gateway_merchants:merchant_id(user_id)")
      .eq("id", order.store_id)
      .maybeSingle();
    const merchantUserId = (store as any)?.gateway_merchants?.user_id;
    allowed = store?.vertical === "pharmacy" && merchantUserId === user.id;
  }
  if (!allowed) return json(403, { error: "forbidden" });

  // Upsert review row
  const { error: rErr } = await supabase
    .from("daily_needs_prescription_reviews")
    .upsert({
      order_id,
      reviewer_id: user.id,
      status: decision,
      notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
  if (rErr) return json(500, { error: "review_write_failed", details: rErr.message });

  // Update order
  const patch: Record<string, unknown> = { prescription_status: decision };
  if (decision === "approved" && order.status === "received") {
    patch.status = "accepted";
  } else if (decision === "rejected") {
    patch.status = "cancelled";
    patch.escrow_status = "refunded";
  }
  const { error: uErr } = await supabase
    .from("daily_needs_orders")
    .update(patch)
    .eq("id", order_id);
  if (uErr) return json(500, { error: "order_update_failed", details: uErr.message });

  // Status history (best-effort)
  if (patch.status) {
    await supabase.from("daily_needs_order_status_history").insert({
      order_id,
      status: patch.status,
      changed_by: user.id,
      reason: `prescription_${decision}`,
    });
  }

  return json(200, { ok: true, decision, order_id });
});
