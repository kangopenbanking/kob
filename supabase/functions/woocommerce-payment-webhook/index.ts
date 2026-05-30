// woocommerce-payment-webhook
// Bridges the Kang gateway settlement pipeline to woocommerce_transactions and
// emits a signed outbound webhook to the merchant's WordPress site.
//
// Modes:
//   1) "sync"   — Called by the PHP plugin with the merchant api_key. Re-checks
//                 settlement state from gateway_charges and reflects it onto
//                 woocommerce_transactions. Safe to call repeatedly.
//   2) "notify" — Called internally with the SERVICE_ROLE key (from gateway
//                 webhook handlers). Updates the matching woocommerce_transactions
//                 row, then POSTs a signed payload to the merchant's webhook URL.
//                 Idempotent via webhook_inbox (source='woocommerce', event_id).
//   3) "inbound"— Called by the merchant's WordPress plugin posting back a status
//                 update. Verified via HMAC-SHA256(X-Kang-Signature) using the
//                 stored webhook_secret_hash. Rejected deterministically on bad
//                 signature with an audit log entry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { checkAndRegisterWebhook, markWebhookProcessed } from "../_shared/webhook-replay-protection.ts";

const TERMINAL = new Set(["completed", "failed", "refunded"]);

async function hmac(payload: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time equality to avoid timing oracles on signature comparison.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function mapGatewayStatus(s: string): "pending" | "processing" | "completed" | "failed" | "refunded" {
  switch ((s || "").toLowerCase()) {
    case "success":
    case "succeeded":
    case "completed":
    case "paid":
      return "completed";
    case "failed":
    case "cancelled":
    case "canceled":
      return "failed";
    case "refunded":
    case "partially_refunded":
      return "refunded";
    case "processing":
    case "authorized":
      return "processing";
    default:
      return "pending";
  }
}

async function deliverOutbound(merchantUrl: string | null | undefined, secret: string, payload: any) {
  if (!merchantUrl) return { delivered: false, reason: "no_webhook_url" };
  const body = JSON.stringify(payload);
  const signature = await hmac(body, secret);
  try {
    const res = await fetch(merchantUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kang-Signature": signature,
        "X-Kang-Event": payload.event,
        "X-Kang-Event-ID": payload.event_id,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { delivered: res.ok, status: res.status };
  } catch (e) {
    return { delivered: false, reason: e instanceof Error ? e.message : "delivery_failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Read raw body once so we can verify HMAC signatures byte-exactly.
  const rawBody = await req.text();
  let body: any;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mode = body?.mode;
  if (mode !== "sync" && mode !== "notify" && mode !== "inbound") {
    return new Response(
      JSON.stringify({ error: "invalid_mode", message: 'mode must be "sync", "notify", or "inbound"' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // ---------- internal NOTIFY (service-role only, with replay protection) ----
    if (mode === "notify") {
      const internalKey = req.headers.get("x-internal-key") || "";
      if (internalKey !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { transaction_ref, status, provider_ref, error_message } = body;
      const idempotency_key: string | undefined =
        body.idempotency_key || body.event_id || req.headers.get("idempotency-key") || undefined;
      if (!transaction_ref || !status) {
        return new Response(JSON.stringify({ error: "transaction_ref and status required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replay/idempotency guard. Duplicates short-circuit with 200.
      const eventId = idempotency_key || `${transaction_ref}:${status}:${provider_ref ?? ""}`;
      const replay = await checkAndRegisterWebhook(supabase, {
        source: "woocommerce",
        event_id: eventId,
        payload: body,
      });
      if (replay.duplicate) {
        return new Response(
          JSON.stringify({ success: true, duplicate: true, reason: replay.reason }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const finalStatus = mapGatewayStatus(status);
      const { data: tx, error: txErr } = await supabase
        .from("woocommerce_transactions")
        .update({
          status: finalStatus,
          error_message: error_message ?? null,
          metadata: { provider_ref, idempotency_key: eventId, settled_via: "notify" },
        })
        .eq("transaction_ref", transaction_ref)
        .select("id, merchant_id, woocommerce_order_id, amount, currency, metadata")
        .maybeSingle();
      if (txErr || !tx) {
        if (replay.inbox_id) await markWebhookProcessed(supabase, replay.inbox_id, "transaction_not_found");
        return new Response(JSON.stringify({ error: "transaction_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: merchant } = await supabase
        .from("woocommerce_merchants")
        .select("webhook_url, webhook_secret_hash")
        .eq("id", tx.merchant_id)
        .maybeSingle();

      const signingMaterial = merchant?.webhook_secret_hash || tx.merchant_id;
      const delivery = await deliverOutbound(merchant?.webhook_url, signingMaterial, {
        event: `payment.${finalStatus}`,
        event_id: eventId,
        transaction_ref,
        woocommerce_order_id: tx.woocommerce_order_id,
        amount: tx.amount,
        currency: tx.currency,
        provider_ref: provider_ref ?? null,
        emitted_at: new Date().toISOString(),
      });

      if (replay.inbox_id) await markWebhookProcessed(supabase, replay.inbox_id);

      return new Response(JSON.stringify({ success: true, status: finalStatus, delivery, event_id: eventId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- INBOUND from WordPress plugin (strict HMAC verification) -------
    if (mode === "inbound") {
      const merchantId: string | undefined = body.merchant_id;
      const signature = req.headers.get("x-kang-signature") || "";
      if (!merchantId || !signature) {
        await supabase.from("audit_logs").insert({
          event_type: "woocommerce.webhook.rejected",
          severity: "warning",
          details: { reason: "missing_signature_or_merchant", merchant_id: merchantId ?? null },
        }).then(() => {}, () => {});
        return new Response(JSON.stringify({ error: "missing_signature_or_merchant" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: merchant } = await supabase
        .from("woocommerce_merchants")
        .select("id, webhook_secret_hash, status")
        .eq("id", merchantId)
        .maybeSingle();

      if (!merchant || merchant.status !== "active" || !merchant.webhook_secret_hash) {
        await supabase.from("audit_logs").insert({
          event_type: "woocommerce.webhook.rejected",
          severity: "warning",
          details: { reason: "merchant_not_verifiable", merchant_id: merchantId },
        }).then(() => {}, () => {});
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expected = await hmac(rawBody, merchant.webhook_secret_hash);
      if (!timingSafeEqual(signature.toLowerCase(), expected.toLowerCase())) {
        await supabase.from("audit_logs").insert({
          event_type: "woocommerce.webhook.signature_invalid",
          severity: "error",
          details: { merchant_id: merchant.id, event: body.event ?? null },
        }).then(() => {}, () => {});
        return new Response(JSON.stringify({ error: "invalid_signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replay protection — use event_id when provided, otherwise hash of body.
      const eventId = body.event_id || (await sha256(rawBody));
      const replay = await checkAndRegisterWebhook(supabase, {
        source: "woocommerce_inbound",
        event_id: eventId,
        payload: body,
        signature,
      });
      if (replay.duplicate) {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Apply status update if present.
      if (body.transaction_ref && body.status) {
        const finalStatus = mapGatewayStatus(body.status);
        await supabase
          .from("woocommerce_transactions")
          .update({ status: finalStatus, metadata: { inbound: true, event_id: eventId } })
          .eq("transaction_ref", body.transaction_ref)
          .eq("merchant_id", merchant.id);
      }

      await supabase.from("audit_logs").insert({
        event_type: "woocommerce.webhook.accepted",
        severity: "info",
        details: { merchant_id: merchant.id, event: body.event ?? null, event_id: eventId },
      }).then(() => {}, () => {});

      if (replay.inbox_id) await markWebhookProcessed(supabase, replay.inbox_id);
      return new Response(JSON.stringify({ success: true, event_id: eventId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- public SYNC (api-key auth, called by plugin) ----------
    const apiKey = body.api_key || req.headers.get("x-api-key") || "";
    const { transaction_ref } = body;
    if (!apiKey || !transaction_ref) {
      return new Response(
        JSON.stringify({ error: "api_key and transaction_ref required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const apiKeyHashHex = await sha256(apiKey);
    const { data: merchant } = await supabase
      .from("woocommerce_merchants")
      .select("id, status")
      .eq("api_key_hash", apiKeyHashHex)
      .maybeSingle();
    if (!merchant || merchant.status !== "active") {
      return new Response(JSON.stringify({ error: "invalid_or_inactive_merchant" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx } = await supabase
      .from("woocommerce_transactions")
      .select("id, status, transaction_ref, kob_transaction_id, woocommerce_order_id, amount, currency")
      .eq("merchant_id", merchant.id)
      .eq("transaction_ref", transaction_ref)
      .maybeSingle();
    if (!tx) {
      return new Response(JSON.stringify({ error: "transaction_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!TERMINAL.has(tx.status) && tx.kob_transaction_id) {
      const { data: charge } = await supabase
        .from("gateway_charges")
        .select("status, provider_ref, failure_reason")
        .eq("id", tx.kob_transaction_id)
        .maybeSingle();
      if (charge) {
        const mapped = mapGatewayStatus(charge.status);
        if (mapped !== tx.status) {
          await supabase
            .from("woocommerce_transactions")
            .update({ status: mapped, error_message: charge.failure_reason ?? null })
            .eq("id", tx.id);
          tx.status = mapped;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_ref: tx.transaction_ref,
        status: tx.status,
        woocommerce_order_id: tx.woocommerce_order_id,
        amount: tx.amount,
        currency: tx.currency,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("woocommerce-payment-webhook error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
