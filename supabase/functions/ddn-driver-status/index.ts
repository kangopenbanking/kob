// DDN — Toggle driver online/offline/paused status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const Body = z.object({ status: z.enum(["online", "offline", "paused"]) });
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

  const { data: driver } = await sb.from("ddn_drivers").select("id, status, approval_status").eq("user_id", user.id).maybeSingle();
  if (!driver) return json(404, { error: "driver_not_found" });
  if (driver.approval_status !== "approved") return json(403, { error: "driver_not_approved" });
  if (driver.status === "busy" || driver.status === "delivering") {
    return json(409, { error: "cannot_change_while_active" });
  }

  const now = new Date().toISOString();
  await sb.from("ddn_drivers").update({ status: parsed.data.status, last_seen_at: now }).eq("id", driver.id);
  await sb.from("ddn_driver_status_log").insert({ driver_id: driver.id, from_status: driver.status, to_status: parsed.data.status });
  return json(200, { ok: true, status: parsed.data.status });
});
