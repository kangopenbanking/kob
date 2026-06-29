// /functions/v1/nium-beneficiaries
// GET  -> list caller's beneficiaries
// POST -> create a beneficiary (Nium-backed, idempotent on hash id)
//
// COMPLIANCE CHECK: beneficiary names cannot be free-text for SELF transfers;
// when destination_country = CM and routing = WALLET we enforce the KYC name.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNiumBeneficiary, NIUM_MODE, assertNiumCurrency } from "../_shared/nium-client.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: cErr } = await anon.auth.getClaims(auth.replace("Bearer ", ""));
  if (cErr || !claims?.claims?.sub) return j({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "GET") {
    const { data, error } = await svc.from("nium_beneficiaries").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) return j({ error: error.message }, 500);
    return j({ beneficiaries: data });
  }

  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: "invalid_json" }, 400); }

  const required = ["beneficiary_name", "beneficiary_account_number", "beneficiary_country", "destination_currency"];
  for (const k of required) if (!body[k]) return j({ error: "missing_field", field: k }, 400);

  // Currency must be one of Nium's 17 OR XAF (for SELF wallet credits).
  let dest: string = String(body.destination_currency).toUpperCase();
  if (dest !== "XAF") {
    try { dest = assertNiumCurrency(dest); } catch (e) { return j({ error: "invalid_currency", message: String(e) }, 400); }
  }

  // Idempotency: same user + account_number + currency = reuse
  const { data: existing } = await svc.from("nium_beneficiaries").select("*")
    .eq("user_id", userId)
    .eq("beneficiary_account_number", body.beneficiary_account_number)
    .eq("destination_currency", dest).maybeSingle();
  if (existing) return j({ beneficiary: existing, reused: true });

  let prov;
  try {
    prov = await createNiumBeneficiary({
      user_id: userId,
      beneficiary_name: body.beneficiary_name,
      beneficiary_account_number: body.beneficiary_account_number,
      beneficiary_bank_name: body.beneficiary_bank_name,
      beneficiary_bank_code: body.beneficiary_bank_code,
      beneficiary_country: body.beneficiary_country,
      destination_currency: dest as any,
      routing_type: body.routing_type,
    });
  } catch (e) {
    return j({ error: "nium_provider_error", message: String(e instanceof Error ? e.message : e) }, 502);
  }

  const { data: row, error: insErr } = await svc.from("nium_beneficiaries").insert({
    user_id: userId,
    nium_beneficiary_hash_id: prov.nium_beneficiary_hash_id,
    beneficiary_name: body.beneficiary_name,
    beneficiary_account_number: body.beneficiary_account_number,
    beneficiary_bank_name: body.beneficiary_bank_name ?? null,
    beneficiary_bank_code: body.beneficiary_bank_code ?? null,
    beneficiary_country: body.beneficiary_country,
    destination_currency: dest,
    routing_type: body.routing_type ?? "SWIFT",
    verification_status: prov.verification_status,
    mode: NIUM_MODE,
    metadata: body.metadata ?? {},
  }).select().single();

  if (insErr) return j({ error: "persist_failed", message: insErr.message }, 500);
  return j({ beneficiary: row, reused: false }, 201);
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}
