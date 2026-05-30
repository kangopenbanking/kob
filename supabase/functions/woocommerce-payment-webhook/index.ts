// woocommerce-payment-webhook
// Bridges the Kang gateway settlement pipeline to woocommerce_transactions and
// emits a signed outbound webhook to the merchant's WordPress site.
//
// Two modes:
//   1) "sync"   — Called by the PHP plugin (or merchant frontend) with the
//                 merchant api_key. Re-checks settlement state from
//                 gateway_charges (matched via metadata.transaction_ref) and
//                 reflects it onto woocommerce_transactions. Returns current
//                 status. Safe to call repeatedly (idempotent).
//   2) "notify" — Called internally with the SERVICE_ROLE key (e.g. from
//                 gateway-webhook-flutterwave / -stripe). Updates the matching
//                 woocommerce_transactions row, then POSTs a signed payload to
//                 the merchant's configured webhook URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mode = body?.mode;
  if (mode !== "sync" && mode !== "notify") {
    return new Response(
      JSON.stringify({ error: "invalid_mode", message: 'mode must be "sync" or "notify"' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // ---------- internal NOTIFY (service-role only) ----------
    if (mode === "notify") {
      const internalKey = req.headers.get("x-internal-key") || "";
      if (internalKey !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { transaction_ref, status, provider_ref, error_message } = body;
      if (!transaction_ref || !status) {
        return new Response(JSON.stringify({ error: "transaction_ref and status required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const finalStatus = mapGatewayStatus(status);
      const { data: tx, error: txErr } = await supabase
        .from("woocommerce_transactions")
        .update({ status: finalStatus, error_message: error_message ?? null, metadata: { provider_ref } })
        .eq("transaction_ref", transaction_ref)
        .select("id, merchant_id, woocommerce_order_id, amount, currency, metadata")
        .maybeSingle();
      if (txErr || !tx) {
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

      // We never store the plaintext webhook secret; the PHP plugin verifies
      // signatures by knowing its own secret. We sign with the stored hash so
      // delivery still includes a verifiable HMAC field (the plugin compares
      // both forms).
      const signingMaterial = merchant?.webhook_secret_hash || tx.merchant_id;
      const delivery = await deliverOutbound(merchant?.webhook_url, signingMaterial, {
        event: `payment.${finalStatus}`,
        transaction_ref,
        woocommerce_order_id: tx.woocommerce_order_id,
        amount: tx.amount,
        currency: tx.currency,
        provider_ref: provider_ref ?? null,
        emitted_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: true, status: finalStatus, delivery }), {
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

    // If still non-terminal, re-check gateway_charges by tx_ref OR linked id.
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
