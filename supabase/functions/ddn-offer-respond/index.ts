// DDN — Driver responds to an open offer (accept / decline).
// Accept goes through ddn_offer_accept RPC (atomic lock).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { notifyUser, getMerchantOwnerId } from "../_shared/ddn-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({ offer_id: z.string().regex(UUID), action: z.enum(["accept", "decline"]) });
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
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });

  if (parsed.data.action === "decline") {
    const { error } = await sb.from("ddn_assignment_offers")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", parsed.data.offer_id).eq("status", "offered");
    if (error) return json(500, { error: "decline_failed", details: error.message });
    return json(200, { ok: true, action: "declined" });
  }

  const { data, error } = await sb.rpc("ddn_offer_accept", { _offer_id: parsed.data.offer_id, _driver_user_id: user.id });
  if (error) return json(500, { error: "accept_failed", details: error.message });
  return json(200, { ok: true, action: "accepted", result: data });
});
