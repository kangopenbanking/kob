// POST /functions/v1/nium-create-global-account
// Auth: required. Body: { currency: "USD"|"EUR"|"GBP", beneficiary_name?: string }
// Returns the persisted Nium global virtual account (IBAN/USD/GBP details).
import { createClient } from "npm:@supabase/supabase-js@2";
import { createGlobalAccount, NIUM_MODE, type NiumCurrency } from "../_shared/nium-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims, error: claimsErr } = await anon.auth.getClaims(auth.replace("Bearer ", ""));
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: { currency?: NiumCurrency; beneficiary_name?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const currency = body.currency;
  if (!currency || !["USD", "EUR", "GBP"].includes(currency)) {
    return json({ error: "invalid_currency", message: "currency must be USD, EUR, or GBP" }, 400);
  }

  const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Look up profile for beneficiary name
  const { data: profile } = await svc.from("profiles").select("full_name, first_name, last_name, email").eq("id", userId).maybeSingle();
  const beneficiary = body.beneficiary_name
    ?? profile?.full_name
    ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
    ?? profile?.email
    ?? "KOB Account Holder";

  // Idempotency: if user already has an account in this currency, return it.
  const { data: existing } = await svc.from("nium_global_accounts").select("*")
    .eq("user_id", userId).eq("currency", currency).eq("status", "active").maybeSingle();
  if (existing) return json({ account: existing, reused: true }, 200);

  let nium;
  try {
    nium = await createGlobalAccount({ user_id: userId, beneficiary_name: beneficiary, currency });
  } catch (e) {
    console.error("nium createGlobalAccount failed", e);
    return json({ error: "nium_provider_error", message: String(e instanceof Error ? e.message : e) }, 502);
  }

  const { data: inserted, error: insErr } = await svc.from("nium_global_accounts").insert({
    user_id: userId,
    nium_customer_hash_id: nium.nium_customer_hash_id,
    nium_account_id: nium.nium_account_id,
    currency: nium.currency,
    iban: nium.iban,
    account_number: nium.account_number,
    routing_code: nium.routing_code,
    bic: nium.bic,
    bank_name: nium.bank_name,
    bank_address: nium.bank_address,
    beneficiary_name: nium.beneficiary_name,
    mode: NIUM_MODE,
    status: "active",
  }).select().single();

  if (insErr) return json({ error: "persist_failed", message: insErr.message }, 500);
  return json({ account: inserted, reused: false }, 201);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
