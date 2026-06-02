// DDN — Driver confirms physical pickup at the merchant.
// Moves assignment to picked_up + on_the_way and updates the underlying order.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { notifyUser, getMerchantOwnerId } from "../_shared/ddn-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({ assignment_id: z.string().regex(UUID) });
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  if (!parsed.success) return json(400, { error: "invalid_body" });

  const { data: a } = await sb
    .from("ddn_assignments")
    .select("id, status, order_id, driver_id, ddn_drivers!ddn_assignments_driver_id_fkey(user_id)")
    .eq("id", parsed.data.assignment_id).maybeSingle();
  if (!a) return json(404, { error: "assignment_not_found" });
  if ((a as any).ddn_drivers?.user_id !== user.id) return json(403, { error: "not_assigned_driver" });
  // State machine validation — only accepted assignments may transition to picked_up/on_the_way
  const { data: allowed } = await sb.rpc("ddn_validate_transition", { _from: a.status, _to: "on_the_way" });
  if (!allowed && !["accepted", "picked_up", "on_the_way"].includes(a.status)) {
    return json(409, { error: "invalid_status", current: a.status, expected: "accepted" });
  }

  const now = new Date().toISOString();
  await sb.from("ddn_assignments").update({ status: "on_the_way", picked_up_at: now }).eq("id", a.id);

  // Transition the order: ready → picked_up → on_the_way
  const stamp = async (to: string) => {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daily-needs-order-transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth, "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
      body: JSON.stringify({ order_id: a.order_id, to_status: to }),
    });
  };
  await stamp("picked_up");
  await stamp("on_the_way");

  return json(200, { ok: true });
});
