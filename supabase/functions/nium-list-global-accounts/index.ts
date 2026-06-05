// GET /functions/v1/nium-list-global-accounts
// Returns the caller's Nium global accounts and recent incoming payments (last 50).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);

  const [accountsRes, paymentsRes, profileRes] = await Promise.all([
    sb.from("nium_global_accounts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("nium_incoming_payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    sb.from("profiles").select("payout_preference, payout_channel").eq("id", userId).maybeSingle(),
  ]);

  return json({
    accounts: accountsRes.data ?? [],
    incoming_payments: paymentsRes.data ?? [],
    user_defaults: profileRes.data ?? { payout_preference: "KANG_WALLET", payout_channel: null },
  });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
