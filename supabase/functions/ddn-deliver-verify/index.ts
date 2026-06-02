// DDN — Driver submits delivery code from customer. On match, marks assignment
// delivered, transitions the order, and credits driver earnings via RPC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({
  assignment_id: z.string().regex(UUID),
  code: z.string().min(3).max(12),
  photo_url: z.string().url().optional(),
  drop_lat: z.number().optional(),
  drop_lng: z.number().optional(),
});
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
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
  const { assignment_id, code, photo_url, drop_lat, drop_lng } = parsed.data;

  const { data: assignment } = await sb
    .from("ddn_assignments")
    .select("id, status, order_id, driver_id, ddn_drivers!ddn_assignments_driver_id_fkey(user_id), daily_needs_orders!inner(delivery_code, status)")
    .eq("id", assignment_id).maybeSingle();
  if (!assignment) return json(404, { error: "assignment_not_found" });

  const driverUser = (assignment as any).ddn_drivers?.user_id;
  if (driverUser !== user.id) return json(403, { error: "not_assigned_driver" });
  if (assignment.status === "delivered") return json(200, { ok: true, replay: true });
  // State machine — only on-the-way / arriving / picked_up can be delivered
  if (!["picked_up", "on_the_way", "arriving"].includes(assignment.status)) {
    return json(409, { error: "invalid_status", current: assignment.status, expected: "on_the_way" });
  }

  const expected = String((assignment as any).daily_needs_orders.delivery_code ?? "").trim();
  if (!expected || expected !== code.trim()) return json(400, { error: "invalid_code", message: "Code mismatch. Ask the customer to read it again or request a new code." });

  const codeHash = await sha256(code.trim());
  const now = new Date().toISOString();

  await sb.from("ddn_delivery_proofs").upsert({
    assignment_id, code_hash: codeHash, code_verified_at: now,
    photo_url: photo_url ?? null, drop_lat: drop_lat ?? null, drop_lng: drop_lng ?? null,
    customer_confirmed: true,
  }, { onConflict: "assignment_id" });

  const { error: uErr } = await sb.from("ddn_assignments")
    .update({ status: "delivered", delivered_at: now }).eq("id", assignment_id).eq("status", "on_the_way" as any);
  // Allow delivery from arriving/accepted too
  if (uErr) await sb.from("ddn_assignments").update({ status: "delivered", delivered_at: now }).eq("id", assignment_id);

  // Transition the order — reuse existing daily-needs-order-transition logic via direct update + escrow settle
  await sb.from("daily_needs_orders").update({ status: "delivered", delivered_at: now }).eq("id", assignment.order_id);

  // Credit driver earnings + reset status (idempotent RPC)
  const { error: settleErr } = await sb.rpc("ddn_settle_delivery", { _assignment_id: assignment_id });
  if (settleErr) return json(500, { error: "settlement_failed", details: settleErr.message });

  return json(200, { ok: true });
});
