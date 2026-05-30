import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { createFlutterwavePayout, createPayPalPayout } from "../_shared/gateway-adapters.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { withRemittanceIdempotency } from "../_shared/remittance-idempotency.ts";
import { recordRemittanceAudit } from "../_shared/remittance-audit.ts";

/**
 * remittance-fulfill — Payout execution engine.
 *
 * Called by remittance-outbound after compliance clears. Executes the
 * actual payout via Flutterwave (MoMo / Bank), PayPal, or KOB Wallet.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // P0 AUTH GATE — internal-only: require service-role/cron secret.
  const cronAuth = verifyCronAuth(req);
  if (!cronAuth.authorized) {
    await recordRemittanceAudit({
      endpoint: 'remittance-fulfill',
      decision: 'denied_unauthenticated',
      req,
    });
    return cronAuth.response!;
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { remittance_id } = body;
    if (!remittance_id) return json({ error: "remittance_id required" }, 400);

    // Idempotency gate — prevents duplicate payouts on retry storms.
    const idem = await withRemittanceIdempotency({
      resource: 'remittance.fulfill',
      defaultKey: remittance_id,
      headerKey: req.headers.get('Idempotency-Key'),
      payload: body,
      corsHeaders,
    });
    if (!idem.proceed) {
      await recordRemittanceAudit({
        endpoint: 'remittance-fulfill',
        decision: 'denied_idempotency',
        remittanceId: remittance_id,
        req,
      });
      return idem.response;
    }

    // Fetch remittance
    const { data: rem, error: rErr } = await supabase
      .from("remittances")
      .select("*")
      .eq("id", remittance_id)
      .single();

    if (rErr || !rem) return json({ error: "Remittance not found" }, 404);

    // Guard: only process if compliance cleared and status is pending/created
    if (!["created", "pending"].includes(rem.status)) {
      return json({ error: `Cannot fulfill — status is ${rem.status}` }, 400);
    }

    const method = rem.delivery_method || "bank_transfer";
    const txRef = `REM-${rem.id.slice(0, 8)}-${Date.now()}`;

    let payoutResult: any = null;
    let providerRef = "";
    let rail = "";

    // ─── WALLET (KOB internal) — synchronous ─────────────────
    if (method === "wallet" || method === "mobile_wallet" || method === "kob_wallet") {
      rail = "wallet";

      // Find sender's account and balance
      const { data: senderAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", rem.sender_user_id)
        .eq("is_active", true)
        .limit(1);

      const senderAccountId = senderAccounts?.[0]?.id;
      if (!senderAccountId) {
        await failRemittance(supabase, rem, "Sender has no active account");
        return json({ error: "Sender has no active account" }, 400);
      }

      const { data: senderBal } = await supabase
        .from("account_balances")
        .select("id, amount")
        .eq("account_id", senderAccountId)
        .eq("balance_type", "ClosingAvailable")
        .eq("credit_debit_indicator", "Credit")
        .maybeSingle();

      if (!senderBal || senderBal.amount < rem.amount_in) {
        await failRemittance(supabase, rem, "Insufficient wallet balance");
        return json({ error: "Insufficient wallet balance" }, 400);
      }

      // Find receiver by phone or email
      let receiverAccountId: string | null = null;
      if (rem.receiver_phone) {
        const { data: recProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone_number", rem.receiver_phone)
          .maybeSingle();
        if (recProfile) {
          const { data: recAcct } = await supabase
            .from("accounts")
            .select("id")
            .eq("user_id", recProfile.id)
            .eq("is_active", true)
            .limit(1);
          receiverAccountId = recAcct?.[0]?.id || null;
        }
      }

      if (!receiverAccountId) {
        await failRemittance(supabase, rem, "Receiver wallet not found");
        return json({ error: "Receiver wallet not found" }, 400);
      }

      // Atomic transfer
      const { data: transferResult, error: trErr } = await supabase.rpc("execute_atomic_transfer", {
        _source_balance_id: senderBal.id,
        _dest_account_id: receiverAccountId,
        _amount: rem.amount_out,
        _currency: rem.currency_out,
      });

      if (trErr) {
        await failRemittance(supabase, rem, trErr.message);
        return json({ error: trErr.message }, 400);
      }

      providerRef = `WALLET-${rem.id.slice(0, 8)}`;

      // Wallet is synchronous — mark delivered immediately
      await supabase.from("remittances").update({
        status: "credited",
        completed_at: new Date().toISOString(),
      }).eq("id", rem.id);

      await supabase.from("remittance_events").insert({
        remittance_id: rem.id,
        event_type: "transfer_delivered",
        payload_raw: JSON.stringify({ rail: "wallet", provider_ref: providerRef, transfer_result: transferResult }),
        signature_valid: true,
      });

      // Notify sender
      if (rem.sender_user_id) {
        await supabase.from("app_notifications").insert({
          user_id: rem.sender_user_id,
          type: "success",
          title: "Transfer Delivered!",
          message: `Your transfer of ${rem.amount_out?.toLocaleString()} ${rem.currency_out} to ${rem.receiver_name} has been delivered.`,
          icon: "check-circle",
          metadata: { remittance_id: rem.id },
        });
      }

      const walletBody = { success: true, rail, status: "credited", provider_ref: providerRef };
      await idem.commit(200, walletBody);
      await recordRemittanceAudit({
        endpoint: 'remittance-fulfill',
        decision: 'allowed',
        remittanceId: rem.id,
        req,
        metadata: { rail, status: 'credited' },
      });
      return json(walletBody);
    }

    // ─── MOBILE MONEY (Flutterwave) ──────────────────────────
    if (method === "mobile_money") {
      rail = "flutterwave_mobile_money";
      try {
        payoutResult = await createFlutterwavePayout({
          amount: rem.amount_out,
          currency: rem.currency_out,
          channel: "mobilemoney",
          beneficiary_phone: rem.receiver_phone || rem.receiver_mobile_wallet,
          beneficiary_name: rem.receiver_name,
          narration: rem.narration || `Transfer to ${rem.receiver_name}`,
          tx_ref: txRef,
        });
        providerRef = payoutResult.provider_ref || txRef;
      } catch (e: any) {
        await failRemittance(supabase, rem, `Flutterwave MoMo: ${e.message}`);
        return json({ error: e.message }, 502);
      }
    }

    // ─── BANK TRANSFER (Flutterwave) ─────────────────────────
    else if (method === "bank_transfer") {
      rail = "flutterwave_bank";
      try {
        payoutResult = await createFlutterwavePayout({
          amount: rem.amount_out,
          currency: rem.currency_out,
          channel: "bank",
          beneficiary_account: rem.receiver_account_number || rem.destination_ref,
          beneficiary_bank: rem.receiver_bank_code,
          beneficiary_name: rem.receiver_name,
          narration: rem.narration || `Transfer to ${rem.receiver_name}`,
          tx_ref: txRef,
        });
        providerRef = payoutResult.provider_ref || txRef;
      } catch (e: any) {
        await failRemittance(supabase, rem, `Flutterwave Bank: ${e.message}`);
        return json({ error: e.message }, 502);
      }
    }

    // ─── LOCAL BANK TRANSFER (KOB v1 → Flutterwave) ─────────
    else if (method === "local_bank_transfer") {
      rail = "kob_local_bank";
      try {
        const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
        if (!flutterwaveSecretKey) throw new Error("Flutterwave not configured");

        const flwRes = await fetch("https://api.flutterwave.com/v3/transfers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flutterwaveSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_bank: rem.receiver_bank_code,
            account_number: rem.receiver_account_number || rem.destination_ref,
            amount: rem.amount_out,
            currency: rem.currency_out || "XAF",
            narration: rem.narration || `KOB transfer to ${rem.receiver_name}`,
            reference: txRef,
            debit_currency: rem.currency_out || "XAF",
            beneficiary_name: rem.receiver_name,
            meta: {
              remittance_id: rem.id,
              rail: "kob_local_bank",
              sender_user_id: rem.sender_user_id,
            },
          }),
        });

        const flwData = await flwRes.json();
        if (flwData.status !== "success") {
          throw new Error(flwData.message || "Flutterwave local bank transfer failed");
        }
        providerRef = String(flwData.data?.id || txRef);
        payoutResult = { provider_ref: providerRef, provider_raw: flwData.data };
      } catch (e: any) {
        await failRemittance(supabase, rem, `Local Bank: ${e.message}`);
        return json({ error: e.message }, 502);
      }
    }

    // ─── PAYPAL ──────────────────────────────────────────────
    else if (method === "paypal" || method === "paypal_email") {
      rail = "paypal";
      try {
        payoutResult = await createPayPalPayout({
          amount: rem.amount_out,
          currency: rem.currency_out,
          channel: "paypal",
          beneficiary_account: rem.receiver_email,
          beneficiary_name: rem.receiver_name,
          narration: rem.narration || `Transfer to ${rem.receiver_name}`,
          tx_ref: txRef,
        });
        providerRef = payoutResult.provider_ref || txRef;
      } catch (e: any) {
        await failRemittance(supabase, rem, `PayPal: ${e.message}`);
        return json({ error: e.message }, 502);
      }
    }

    // ─── UNSUPPORTED ─────────────────────────────────────────
    else {
      await failRemittance(supabase, rem, `Unsupported delivery method: ${method}`);
      return json({ error: `Unsupported delivery method: ${method}` }, 400);
    }

    // ─── Common: Create gateway_payouts record + update status ─
    await supabase.from("gateway_payouts").insert({
      tx_ref: txRef,
      provider: rail.startsWith("flutterwave") ? "flutterwave" : "paypal",
      provider_ref: providerRef,
      amount: rem.amount_out,
      currency: rem.currency_out,
      channel: method,
      status: "pending",
      metadata: { remittance_id: rem.id, rail, sender_user_id: rem.sender_user_id },
      provider_raw: payoutResult?.provider_raw || {},
    });

    // Move remittance to received (in_transit equivalent)
    await supabase.from("remittances").update({
      status: "received",
    }).eq("id", rem.id);

    // Log fulfillment event
    await supabase.from("remittance_events").insert({
      remittance_id: rem.id,
      event_type: "payout_initiated",
      payload_raw: JSON.stringify({ rail, tx_ref: txRef, provider_ref: providerRef, amount: rem.amount_out }),
      signature_valid: true,
    });

    // Audit
    await supabase.from("audit_logs").insert({
      action_type: "remittance_payout_initiated",
      entity_type: "remittance",
      entity_id: rem.id,
      details: { rail, tx_ref: txRef, provider_ref: providerRef, delivery_method: method },
    });

    return json({ success: true, rail, status: "received", tx_ref: txRef, provider_ref: providerRef });
  } catch (err: any) {
    console.error("remittance-fulfill error:", err);
    return json({ error: err.message }, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function failRemittance(supabase: any, rem: any, reason: string) {
  await supabase.from("remittances").update({
    status: "failed",
    cancellation_reason: reason,
    cancelled_at: new Date().toISOString(),
  }).eq("id", rem.id);

  await supabase.from("remittance_events").insert({
    remittance_id: rem.id,
    event_type: "payout_failed",
    payload_raw: JSON.stringify({ error: reason }),
    signature_valid: true,
  });

  if (rem.sender_user_id) {
    await supabase.from("app_notifications").insert({
      user_id: rem.sender_user_id,
      type: "warning",
      title: "Transfer Failed",
      message: `Your transfer to ${rem.receiver_name} could not be completed. ${reason}`,
      icon: "x-circle",
      metadata: { remittance_id: rem.id },
    });
  }
}
