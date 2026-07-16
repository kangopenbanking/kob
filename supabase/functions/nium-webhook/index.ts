// POST /functions/v1/nium-webhook
// Public endpoint — Nium sends incoming-payment events here. HMAC-SHA256 verified.
// Idempotent on nium_transaction_id. Always returns 200 once persisted; downstream
// MoMo payout is dispatched asynchronously via the existing Flutterwave functions.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhookSignature, getFxQuote, type NiumCurrency } from "../_shared/nium-client.ts";
import {
  checkAndRegisterWebhook,
  computePayloadFingerprint,
  enforceReplayWindow,
  markWebhookProcessed,
} from "../_shared/webhook-replay-protection.ts";

const REPLAY_WINDOW_SECONDS = 300; // ±5 min accepted skew when timestamp is provided

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-nium-signature, x-nium-signature-key, x-nium-event, x-nium-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  const hadKey = !!req.headers.get("x-nium-signature-key");
  const hadHmac = !!req.headers.get("x-nium-signature");

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const audit = async (
    outcome: "accepted" | "rejected" | "duplicate",
    reason: string,
    status_code: number,
    event_id: string | null,
    event_type: string | null,
    body_bytes: number,
  ) => {
    try {
      await svc.from("nium_webhook_audit").insert({
        event_id, event_type, outcome, reason, status_code,
        client_ip: clientIp, user_agent: userAgent,
        had_signature_key: hadKey, had_hmac_signature: hadHmac,
        body_bytes,
      });
    } catch (e) { console.warn("audit insert failed", e); }
  };

  const raw = await req.text();
  const bodyBytes = raw.length;

  const sigOk = await verifyWebhookSignature(
    raw,
    req.headers.get("x-nium-signature"),
    req.headers.get("x-nium-signature-key"),
  );
  if (!sigOk) {
    await audit("rejected", "invalid_signature", 401, null, null, bodyBytes);
    return json({ error: "invalid_signature" }, 401);
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    await audit("rejected", "invalid_json", 400, null, null, bodyBytes);
    return json({ error: "invalid_json" }, 400);
  }

  const eventType = String(payload.eventType ?? payload.event ?? req.headers.get("x-nium-event") ?? "").toLowerCase();
  const eventId = String(
    payload.eventId ?? payload.event_id ?? payload.transactionId ?? payload.systemReferenceNumber ?? payload.id ?? "",
  ) || null;

  // --- Replay-window enforcement (opt-in on presence of x-nium-timestamp) ---
  // When Nium includes a timestamp header, reject deliveries whose skew exceeds
  // REPLAY_WINDOW_SECONDS. Absence is tolerated for back-compat.
  const tsHeader = req.headers.get("x-nium-timestamp") ?? payload.timestamp ?? payload.eventTime ?? null;
  const window = enforceReplayWindow(tsHeader, REPLAY_WINDOW_SECONDS);
  if (!window.ok) {
    await audit("rejected", window.reason, 401, eventId, eventType || null, bodyBytes);
    return json(
      { error: window.reason, ...("skew_seconds" in window ? { skew_seconds: window.skew_seconds } : {}) },
      401,
    );
  }

  // --- Replay protection: dedupe by (source=nium, event_id) with 24h TTL ---
  // Also protects against fingerprint reuse (same event_id, mutated body) and
  // reserve-then-crash recovery (unprocessed reservation older than 90s is
  // reclaimed for reprocessing by this delivery).
  const payloadFingerprint = await computePayloadFingerprint(raw);
  let inboxId: string | null = null;
  if (eventId) {
    const replay = await checkAndRegisterWebhook(svc, {
      source: "nium",
      event_id: eventId,
      payload,
      signature: req.headers.get("x-nium-signature-key") ? "static-key" : (req.headers.get("x-nium-signature") ?? undefined),
      payload_fingerprint: payloadFingerprint,
    });
    if (replay.mismatch) {
      await audit("rejected", "payload_fingerprint_mismatch", 409, eventId, eventType || null, bodyBytes);
      return json({ error: "payload_fingerprint_mismatch", event_id: eventId }, 409);
    }
    if (replay.duplicate) {
      await audit("duplicate", "duplicate_within_ttl", 200, eventId, eventType || null, bodyBytes);
      return json({ received: true, duplicate: true, event_id: eventId }, 200);
    }
    inboxId = replay.inbox_id ?? null;
    if (replay.retried) {
      await audit("accepted", "stale_retry_reclaimed", 200, eventId, eventType || null, bodyBytes);
    }
  }

  await audit("accepted", "signature_valid", 200, eventId, eventType || null, bodyBytes);
  // Best-effort mark-processed after ACK. Non-blocking on error.
  const markProcessed = async (err?: string) => {
    if (inboxId) {
      try { await markWebhookProcessed(svc, inboxId, err); } catch (e) { console.warn("markProcessed failed", e); }
    }
  };
  // Register a queueMicrotask so downstream handlers below can early-return
  // without every branch calling markProcessed; the microtask runs after
  // Deno.serve resolves the Response.
  queueMicrotask(() => { void markProcessed(); });




  // --- Payout status events ---
  if (eventType.includes("payout") || eventType.includes("transfer")) {
    const transferId = payload.transactionId ?? payload.systemReferenceNumber ?? payload.id;
    const status = String(payload.status ?? "").toLowerCase() || "processing";
    if (!transferId) return json({ error: "missing_transfer_id" }, 400);
    const map: Record<string, string> = {
      success: "completed", completed: "completed", paid: "completed",
      failed: "failed", rejected: "failed",
      processing: "processing", pending: "processing", submitted: "submitted",
    };
    const mapped = map[status] ?? "processing";
    const { error } = await svc.from("nium_payouts").update({
      status: mapped,
      failure_reason: mapped === "failed" ? (payload.failureReason ?? payload.reason ?? null) : null,
      completed_at: mapped === "completed" ? new Date().toISOString() : null,
    }).eq("nium_transfer_id", transferId);
    if (error) console.warn("payout update failed", error.message);
    return json({ received: true, kind: "payout", transfer_id: transferId, status: mapped });
  }

  // --- Conversion status events ---
  if (eventType.includes("conversion") || eventType.includes("fx")) {
    const convId = payload.conversionId ?? payload.id;
    const status = String(payload.status ?? "").toLowerCase() || "completed";
    if (!convId) return json({ error: "missing_conversion_id" }, 400);
    const { error } = await svc.from("nium_conversions").update({
      status: status.includes("fail") ? "failed" : (status.includes("pend") ? "pending" : "completed"),
      completed_at: !status.includes("fail") && !status.includes("pend") ? new Date().toISOString() : null,
    }).eq("nium_conversion_id", convId);
    if (error) console.warn("conversion update failed", error.message);
    return json({ received: true, kind: "conversion", conversion_id: convId });
  }

  // --- RFI (Request for Information) events ---
  if (eventType.includes("rfi") || eventType.includes("compliance_request")) {
    const rfiId = payload.rfiId ?? payload.id;
    if (!rfiId) return json({ error: "missing_rfi_id" }, 400);
    const subjectRef = payload.subjectReference ?? payload.referenceNumber ?? null;
    const subjectType = payload.subjectType ?? (subjectRef?.startsWith("nium_txfr") ? "payout" : "account");

    // Resolve user from subject (best effort)
    let userId: string | null = null;
    if (subjectType === "payout" && subjectRef) {
      const { data } = await svc.from("nium_payouts").select("user_id").eq("nium_transfer_id", subjectRef).maybeSingle();
      userId = data?.user_id ?? null;
    } else if (subjectRef) {
      const { data } = await svc.from("nium_global_accounts").select("user_id").eq("nium_account_id", subjectRef).maybeSingle();
      userId = data?.user_id ?? null;
    }

    const { error } = await svc.from("nium_rfi").upsert({
      nium_rfi_id: rfiId,
      user_id: userId,
      subject_type: subjectType,
      subject_reference: subjectRef,
      rfi_reason: payload.reason ?? "compliance_review",
      rfi_details: payload.details ?? payload.message ?? null,
      status: String(payload.status ?? "open").toLowerCase(),
      due_by: payload.dueBy ?? null,
      mode: "live",
      metadata: payload,
    }, { onConflict: "nium_rfi_id" });
    if (error) console.warn("rfi upsert failed", error.message);
    return json({ received: true, kind: "rfi", rfi_id: rfiId });
  }

  // --- Virtual / Global account status update events ---
  if (
    eventType.includes("account.status") ||
    eventType === "account.suspended" ||
    eventType === "account.closed" ||
    eventType === "account.reactivated" ||
    eventType === "account.status_updated"
  ) {
    const accountId = payload.accountId ?? payload.beneficiaryAccountId ?? payload.id;
    if (!accountId) return json({ error: "missing_account_id" }, 400);
    const raw = String(payload.status ?? payload.newStatus ?? "").toLowerCase();
    const statusMap: Record<string, string> = {
      active: "active", enabled: "active", reactivated: "active",
      suspended: "suspended", frozen: "suspended", blocked: "suspended",
      closed: "closed", terminated: "closed", deleted: "closed",
    };
    const mapped = statusMap[raw] ?? "active";
    const { data: updated, error } = await svc.from("nium_global_accounts")
      .update({ status: mapped, updated_at: new Date().toISOString() })
      .eq("nium_account_id", accountId)
      .select("id, user_id, account_kind, status").maybeSingle();
    if (error) console.warn("account status update failed", error.message);
    return json({
      received: true, kind: "account_status",
      nium_account_id: accountId, status: mapped, account_id: updated?.id ?? null,
    });
  }

  // --- Incoming payments (existing behavior) ---
  if (!eventType.includes("payment_incoming") && !eventType.includes("credit")) {
    return json({ received: true, ignored_event: eventType }, 200);
  }

  const niumTxId: string = payload.transactionId ?? payload.systemReferenceNumber ?? payload.id;
  const niumAccountId: string = payload.accountId ?? payload.beneficiaryAccountId;
  const sourceAmount = Number(payload.amount ?? payload.transactionAmount);
  const sourceCurrency = String(payload.currency ?? payload.transactionCurrency ?? "USD").toUpperCase() as NiumCurrency;

  if (!niumTxId || !niumAccountId || !Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return json({ error: "missing_fields", required: ["transactionId", "accountId", "amount", "currency"] }, 400);
  }

  // svc already initialized above


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
