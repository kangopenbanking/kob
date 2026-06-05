// PATCH /functions/v1/nium-update-payout-preference
// Body (one of):
//   { scope:"user", payout_preference:"KANG_WALLET"|"MOBILE_MONEY", payout_channel?:string }
//   { scope:"account", account_id:uuid, payout_preference_override:null|"...", payout_channel_override?:string }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "PATCH, POST, OPTIONS",
};
const PREF = ["KANG_WALLET", "MOBILE_MONEY"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["PATCH", "POST"].includes(req.method)) return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  if (body.scope === "user") {
    if (body.payout_preference && !PREF.includes(body.payout_preference)) {
      return json({ error: "invalid_payout_preference" }, 400);
    }
    if (body.payout_preference === "MOBILE_MONEY" && !body.payout_channel) {
      return json({ error: "payout_channel_required", message: "phone number required for mobile money" }, 400);
    }
    const { data, error } = await sb.from("profiles").update({
      payout_preference: body.payout_preference,
      payout_channel: body.payout_channel ?? null,
    }).eq("id", userId).select("payout_preference, payout_channel").single();
    if (error) return json({ error: "update_failed", message: error.message }, 500);
    return json({ user_defaults: data });
  }

  if (body.scope === "account") {
    if (!body.account_id) return json({ error: "account_id_required" }, 400);
    if (body.payout_preference_override !== null && !PREF.includes(body.payout_preference_override)) {
      return json({ error: "invalid_payout_preference_override" }, 400);
    }
    const { data, error } = await sb.from("nium_global_accounts").update({
      payout_preference_override: body.payout_preference_override,
      payout_channel_override: body.payout_channel_override ?? null,
    }).eq("id", body.account_id).eq("user_id", userId).select().maybeSingle();
    if (error) return json({ error: "update_failed", message: error.message }, 500);
    if (!data) return json({ error: "account_not_found" }, 404);
    return json({ account: data });
  }

  return json({ error: "invalid_scope", message: "scope must be 'user' or 'account'" }, 400);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
