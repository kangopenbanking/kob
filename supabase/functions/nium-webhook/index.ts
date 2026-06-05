// POST /functions/v1/nium-webhook
// Public endpoint — Nium sends incoming-payment events here. HMAC-SHA256 verified.
// Idempotent on nium_transaction_id. Always returns 200 once persisted; downstream
// MoMo payout is dispatched asynchronously via the existing Flutterwave functions.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhookSignature, getFxQuote, type NiumCurrency } from "../_shared/nium-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-nium-signature, x-nium-event",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  const sigOk = await verifyWebhookSignature(raw, req.headers.get("x-nium-signature"));
  if (!sigOk) return json({ error: "invalid_signature" }, 401);

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }

  const eventType = payload.eventType ?? payload.event ?? req.headers.get("x-nium-event") ?? "";
  if (!String(eventType).toLowerCase().includes("payment_incoming")
      && !String(eventType).toLowerCase().includes("credit")) {
    // Ack and ignore unrelated events
    return json({ received: true, ignored_event: eventType }, 200);
  }

  const niumTxId: string = payload.transactionId ?? payload.systemReferenceNumber ?? payload.id;
  const niumAccountId: string = payload.accountId ?? payload.beneficiaryAccountId;
  const sourceAmount = Number(payload.amount ?? payload.transactionAmount);
  const sourceCurrency = String(payload.currency ?? payload.transactionCurrency ?? "USD").toUpperCase() as NiumCurrency;

  if (!niumTxId || !niumAccountId || !Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return json({ error: "missing_fields", required: ["transactionId", "accountId", "amount", "currency"] }, 400);
  }

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotency check
  const { data: dup } = await svc.from("nium_incoming_payments").select("id, status").eq("nium_transaction_id", niumTxId).maybeSingle();
  if (dup) return json({ received: true, duplicate: true, id: dup.id, status: dup.status }, 200);

  // Look up VA
  const { data: ga, error: gaErr } = await svc.from("nium_global_accounts").select("*").eq("nium_account_id", niumAccountId).maybeSingle();
  if (gaErr || !ga) return json({ error: "account_not_found", nium_account_id: niumAccountId }, 404);

  // Resolve routing (account override > user default)
  const { data: routingRows } = await svc.rpc("resolve_nium_routing", { _account_id: ga.id });
  const resolved = (Array.isArray(routingRows) ? routingRows[0] : routingRows) ?? { routing: "KANG_WALLET", channel: null };
  const routing: "KANG_WALLET" | "MOBILE_MONEY" = resolved.routing;
  const channel: string | null = resolved.channel;

  // Pull spread bps from fee_structures (platform default), fallback 75 bps
  const { data: spreadRow } = await svc.from("fee_structures").select("percentage_rate")
    .eq("transaction_type", "nium_fx_spread").eq("fee_scope", "platform").eq("is_active", true)
    .order("effective_from", { ascending: false }).limit(1).maybeSingle();
  const spreadBps = Math.round((Number(spreadRow?.percentage_rate ?? 0.0075)) * 10000);

  // FX
  const quote = await getFxQuote(sourceCurrency, sourceAmount);
  const xafGross = Math.round(sourceAmount * quote.rate);                       // before spread
  const xafSpreadRevenue = Math.round(xafGross * spreadBps / 10000);
  const xafAfterSpread = xafGross - xafSpreadRevenue;

  // Withdrawal fee only applies on MOBILE_MONEY routing
  let xafFee = 0;
  if (routing === "MOBILE_MONEY") {
    const { data: feeRow } = await svc.from("fee_structures").select("fixed_amount, percentage_rate, min_fee_amount, max_fee_amount")
      .eq("transaction_type", "nium_withdrawal").eq("fee_scope", "platform").eq("is_active", true)
      .order("effective_from", { ascending: false }).limit(1).maybeSingle();
    const fixed = Number(feeRow?.fixed_amount ?? 100);
    const pct = Number(feeRow?.percentage_rate ?? 0.01);
    const min = Number(feeRow?.min_fee_amount ?? 200);
    const max = feeRow?.max_fee_amount ? Number(feeRow.max_fee_amount) : null;
    let computed = Math.round(fixed + xafAfterSpread * pct);
    computed = Math.max(min, computed);
    if (max && computed > max) computed = max;
    xafFee = Math.min(computed, xafAfterSpread - 1);
  }
  const xafNet = Math.max(0, xafAfterSpread - xafFee);

  const initialStatus = routing === "KANG_WALLET" ? "credited" : "payout_pending";

  const { data: row, error: insErr } = await svc.from("nium_incoming_payments").insert({
    nium_transaction_id: niumTxId,
    global_account_id: ga.id,
    user_id: ga.user_id,
    source_amount: sourceAmount,
    source_currency: sourceCurrency,
    fx_rate_nium: quote.rate,
    fx_spread_bps: spreadBps,
    xaf_gross: xafGross,
    xaf_spread_revenue: xafSpreadRevenue,
    xaf_withdrawal_fee: xafFee,
    xaf_net_credited: xafNet,
    routing,
    payout_channel: routing === "MOBILE_MONEY" ? channel : null,
    status: initialStatus,
    pop_code: ga.pop_code ?? null, // COMPLIANCE CHECK: carry BEAC PoP onto each settlement
    raw_payload: payload,
  }).select().single();

  if (insErr) {
    console.error("nium-webhook insert failed", insErr);
    return json({ error: "persist_failed", message: insErr.message }, 500);
  }

  // Best-effort downstream payout dispatch (do not block ACK to Nium).
  if (routing === "MOBILE_MONEY" && channel) {
    try {
      // Reuse existing Flutterwave gateway-create-payout function.
      const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gateway-create-payout`;
      const dispatch = await fetch(dispatchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Idempotency-Key": `nium-${niumTxId}`,
        },
        body: JSON.stringify({
          source: "nium_incoming",
          nium_payment_id: row.id,
          amount: xafNet,
          currency: "XAF",
          channel: "mobile_money",
          beneficiary_phone: channel,
          narration: `Nium ${sourceCurrency} ${sourceAmount} → MoMo`,
          tx_ref: `nium_${niumTxId}`,
        }),
      });
      if (!dispatch.ok) {
        console.warn("Flutterwave dispatch non-2xx, will be retried by worker", dispatch.status);
      } else {
        const j = await dispatch.json().catch(() => ({}));
        if (j?.id) {
          await svc.from("nium_incoming_payments").update({ flutterwave_payout_id: String(j.id) }).eq("id", row.id);
        }
      }
    } catch (e) {
      console.warn("dispatch failed (will retry)", e);
    }
  }

  return json({ received: true, id: row.id, routing, xaf_net_credited: xafNet }, 200);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
