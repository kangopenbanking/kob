// /functions/v1/nium-conversions
// GET  -> list caller's FX conversions
// POST -> convert balance between currencies on a Nium global account
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNiumConversion, NIUM_MODE, assertNiumCurrency } from "../_shared/nium-client.ts";

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
    const { data, error } = await svc.from("nium_conversions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) return j({ error: error.message }, 500);
    return j({ conversions: data });
  }

  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: "invalid_json" }, 400); }

  const idemKey = req.headers.get("idempotency-key");
  if (!idemKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idemKey)) {
    return j({ error: "invalid_idempotency_key" }, 400);
  }

  for (const k of ["source_account_id", "source_amount", "destination_currency"]) {
    if (!body[k]) return j({ error: "missing_field", field: k }, 400);
  }
  const amount = Number(body.source_amount);
  if (!Number.isFinite(amount) || amount <= 0) return j({ error: "invalid_amount" }, 400);

  // Replay
  const { data: dup } = await svc.from("nium_conversions").select("*").eq("idempotency_key", idemKey).maybeSingle();
  if (dup) return j({ conversion: dup, replayed: true });

  const { data: src } = await svc.from("nium_global_accounts").select("*").eq("id", body.source_account_id).eq("user_id", userId).maybeSingle();
  if (!src) return j({ error: "source_account_not_found" }, 404);

  const sourceCur = assertNiumCurrency(src.currency);
  const destCur = String(body.destination_currency).toUpperCase();
  if (destCur !== "XAF") {
    try { assertNiumCurrency(destCur); } catch (e) { return j({ error: "invalid_destination_currency", message: String(e) }, 400); }
  }
  if (destCur === sourceCur) return j({ error: "same_currency_conversion" }, 400);

  let prov;
  try {
    prov = await createNiumConversion({
      user_id: userId,
      source_account_id: src.id,
      source_currency: sourceCur,
      source_amount: amount,
      destination_currency: destCur as any,
    });
  } catch (e) {
    return j({ error: "nium_provider_error", message: String(e instanceof Error ? e.message : e) }, 502);
  }

  // 75 bps default spread (consistent with nium-webhook)
  const fxSpreadBps = 75;

  const { data: row, error: insErr } = await svc.from("nium_conversions").insert({
    user_id: userId,
    source_account_id: src.id,
    nium_conversion_id: prov.nium_conversion_id,
    idempotency_key: idemKey,
    source_currency: sourceCur,
    source_amount: amount,
    destination_currency: destCur,
    destination_amount: prov.destination_amount,
    fx_rate: prov.fx_rate,
    fx_spread_bps: fxSpreadBps,
    status: prov.status,
    mode: NIUM_MODE,
    completed_at: prov.status === "completed" ? new Date().toISOString() : null,
    metadata: body.metadata ?? {},
  }).select().single();

  if (insErr) return j({ error: "persist_failed", message: insErr.message }, 500);
  return j({ conversion: row, replayed: false }, 201);
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}
