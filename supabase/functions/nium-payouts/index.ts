// /functions/v1/nium-payouts
// GET  -> list caller's payouts
// POST -> create a payout from a Nium global account to a registered beneficiary
//
// Idempotent on Idempotency-Key header (UUID v4) per (user, beneficiary, amount).
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNiumPayout, getFxQuote, NIUM_MODE, assertNiumCurrency } from "../_shared/nium-client.ts";
import { DEFAULT_NIUM_POP_CODE, isAllowedNiumPopCode } from "../_shared/nium-compliance.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
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
    const { data, error } = await svc.from("nium_payouts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) return j({ error: error.message }, 500);
    return j({ payouts: data });
  }

  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: "invalid_json" }, 400); }

  const idemKey = req.headers.get("idempotency-key");
  if (!idemKey) return j({ error: "missing_idempotency_key" }, 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idemKey)) {
    return j({ error: "invalid_idempotency_key", message: "must be UUID v4" }, 400);
  }

  for (const k of ["beneficiary_id", "source_account_id", "source_amount"]) {
    if (!body[k]) return j({ error: "missing_field", field: k }, 400);
  }
  const amount = Number(body.source_amount);
  if (!Number.isFinite(amount) || amount <= 0) return j({ error: "invalid_amount" }, 400);

  const popCode = body.purpose_code ?? DEFAULT_NIUM_POP_CODE;
  if (!isAllowedNiumPopCode(popCode)) return j({ error: "pop_code_forbidden" }, 400);

  // Replay: same idempotency key returns cached row
  const { data: dup } = await svc.from("nium_payouts").select("*").eq("idempotency_key", idemKey).maybeSingle();
  if (dup) return j({ payout: dup, replayed: true });

  // Load source account + beneficiary
  const { data: src } = await svc.from("nium_global_accounts").select("*").eq("id", body.source_account_id).eq("user_id", userId).maybeSingle();
  if (!src) return j({ error: "source_account_not_found" }, 404);
  const { data: ben } = await svc.from("nium_beneficiaries").select("*").eq("id", body.beneficiary_id).eq("user_id", userId).maybeSingle();
  if (!ben) return j({ error: "beneficiary_not_found" }, 404);

  const sourceCur = assertNiumCurrency(src.currency);
  const destCur = ben.destination_currency;

  // Quote FX (only when source != dest)
  let fxRate = 1;
  let destAmount = amount;
  if (sourceCur !== destCur) {
    const quote = destCur === "XAF" ? await getFxQuote(sourceCur, amount) : { rate: 1, source_currency: sourceCur, target_currency: "XAF" as const, quote_id: "x" };
    fxRate = quote.rate;
    destAmount = Math.round(amount * fxRate * 100) / 100;
  }

  let prov;
  try {
    prov = await createNiumPayout({
      user_id: userId,
      beneficiary_hash_id: ben.nium_beneficiary_hash_id,
      source_currency: sourceCur,
      source_amount: amount,
      destination_currency: destCur,
      destination_amount: destAmount,
      fx_rate: fxRate,
      purpose_code: popCode,
    });
  } catch (e) {
    return j({ error: "nium_provider_error", message: String(e instanceof Error ? e.message : e) }, 502);
  }

  const { data: row, error: insErr } = await svc.from("nium_payouts").insert({
    user_id: userId,
    beneficiary_id: ben.id,
    source_account_id: src.id,
    nium_transfer_id: prov.nium_transfer_id,
    idempotency_key: idemKey,
    source_currency: sourceCur,
    source_amount: amount,
    destination_currency: destCur,
    destination_amount: destAmount,
    fx_rate: fxRate,
    status: prov.status,
    purpose_code: popCode,
    mode: NIUM_MODE,
    metadata: body.metadata ?? {},
  }).select().single();

  if (insErr) return j({ error: "persist_failed", message: insErr.message }, 500);
  return j({ payout: row, replayed: false }, 201);
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}
