// POST /functions/v1/nium-quote-payout
// Auth: required. Returns a non-binding XAF settlement preview for a hypothetical
// incoming Nium payment, sharing the EXACT FX + fee math used by nium-webhook.
//
// COMPLIANCE CHECK (Double-spread FX transparency): caller MUST be shown
// gross → Nium FX → KOB spread → MoMo fee → Net XAF before confirming any cash-out.
import { createClient } from "npm:@supabase/supabase-js@2";
import { quoteBreakdown, type Routing } from "../_shared/nium-fx.ts";
import { NIUM_SUPPORTED_CURRENCIES, type NiumCurrency } from "../_shared/nium-client.ts";

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

  let body: { source_amount?: number; source_currency?: string; routing?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const sourceAmount = Number(body.source_amount);
  const sourceCurrency = String(body.source_currency ?? "").toUpperCase() as NiumCurrency;
  const routing = (body.routing ?? "KANG_WALLET").toUpperCase() as Routing;

  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return json({ error: "invalid_amount" }, 400);
  }
  if (!(NIUM_SUPPORTED_CURRENCIES as readonly string[]).includes(sourceCurrency)) {
    return json({ error: "invalid_currency", message: `must be one of ${NIUM_SUPPORTED_CURRENCIES.join(", ")}` }, 400);
  }
  if (!["KANG_WALLET", "MOBILE_MONEY"].includes(routing)) {
    return json({ error: "invalid_routing" }, 400);
  }

  const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const breakdown = await quoteBreakdown(svc, {
      source_amount: sourceAmount,
      source_currency: sourceCurrency,
      routing,
    }, { allowReferenceFallback: true });
    return json({
      ...breakdown,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      disclosure:
        "Indicative quote only. Final amount uses the FX rate live at the moment Nium credits the funds.",
    });
  } catch (e) {
    console.error("nium-quote-payout failed", e);
    return json({ error: "quote_failed", message: String(e instanceof Error ? e.message : e) }, 502);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
