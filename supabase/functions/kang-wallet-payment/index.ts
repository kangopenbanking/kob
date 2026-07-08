// Kang Agent — Wallet-only subscription payment
// Debits the monthly subscription fee from the user's Kang wallet.
// No external payment gateways. Atomic via the kang_debit_wallet RPC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { success: false, error: "missing_token" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !userRes?.user) return json(401, { success: false, error: "invalid_token" });
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load fee from kang_config
    const { data: cfg } = await admin
      .from("kang_config")
      .select("value")
      .eq("key", "monthly_fee")
      .maybeSingle();
    const monthlyFee = Number((cfg?.value as any)?.amount ?? 2000);
    const currency = String((cfg?.value as any)?.currency ?? "XAF");

    // Ensure subscription row
    let { data: sub } = await admin
      .from("kang_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub) {
      const { data: created } = await admin
        .from("kang_subscriptions")
        .insert({ user_id: userId, status: "trial", questions_asked_count: 0, free_questions_limit: 5, last_payment_status: "none" })
        .select("*")
        .single();
      sub = created;
    }

    const paymentReference = crypto.randomUUID();

    // Atomic wallet debit via RPC
    const { data: debit, error: debitErr } = await admin.rpc("kang_debit_wallet", {
      p_user_id: userId,
      p_amount: monthlyFee,
      p_reference: paymentReference,
    });
    if (debitErr) {
      console.error("kang_debit_wallet RPC error", debitErr);
      return json(500, { success: false, error: "debit_rpc_failed", detail: debitErr.message });
    }

    const debitResult = debit as any;

    if (!debitResult?.success) {
      // Insufficient funds or no wallet — suspend subscription + -3 credit points
      const currentBalance = Number(debitResult?.current_balance ?? 0);
      const errorCode = String(debitResult?.error ?? "payment_failed");

      await admin.from("kang_subscriptions").update({
        status: "suspended",
        last_payment_status: "failed",
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      await admin.from("kang_billing_logs").insert({
        user_id: userId,
        payment_reference: paymentReference,
        amount: monthlyFee,
        currency,
        status: "failed",
        reason: errorCode,
        balance_before: currentBalance,
        balance_after: currentBalance,
        triggered_by: "user",
      });

      await admin.from("credit_score_ledger").insert({
        user_id: userId,
        points_change: -3,
        reason: "Monthly Subscription Payment Failed - Insufficient Wallet Funds",
      });
      await admin.rpc("increment_credit_score", { p_user_id: userId, p_delta: -3 }).catch(() => {});

      await admin.from("kang_notifications").insert({
        user_id: userId,
        type: "payment_failed",
        title: "Kang Agent payment failed",
        message: errorCode === "insufficient_funds"
          ? `We couldn't debit ${monthlyFee} ${currency} — your wallet balance is ${currentBalance} ${currency}. Top up to reactivate Premium.`
          : "We couldn't process your subscription payment. Please try again.",
        metadata: { payment_reference: paymentReference, error: errorCode, required: monthlyFee, current_balance: currentBalance },
      });

      return json(200, {
        success: false,
        error: errorCode,
        required: monthlyFee,
        current_balance: currentBalance,
        currency,
        message: errorCode === "insufficient_funds"
          ? "Insufficient wallet balance. Please top up your wallet to activate Premium."
          : "No active wallet found. Please set up your wallet before subscribing.",
      });
    }

    // Success — activate subscription for 30 days, reset counter, +1 credit point
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await admin.from("kang_subscriptions").update({
      status: "active",
      last_payment_status: "success",
      questions_asked_count: 0,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    }).eq("user_id", userId);

    await admin.from("kang_billing_logs").insert({
      user_id: userId,
      payment_reference: paymentReference,
      amount: monthlyFee,
      currency,
      status: "success",
      reason: "Monthly Subscription Paid from Wallet",
      balance_before: debitResult.balance_before,
      balance_after: debitResult.balance_after,
      triggered_by: "user",
    });

    await admin.from("credit_score_ledger").insert({
      user_id: userId,
      points_change: 1,
      reason: "Monthly Subscription Paid from Wallet",
    });
    await admin.rpc("increment_credit_score", { p_user_id: userId, p_delta: 1 }).catch(() => {});

    // Record a debit transaction for the user's ledger visibility
    await admin.from("transactions").insert({
      user_id: userId,
      account_id: debitResult.account_id,
      amount: monthlyFee,
      currency,
      transaction_type: "debit",
      credit_debit_indicator: "Debit",
      status: "Booked",
      transaction_information: "Kang Agent Premium — Monthly Subscription",
      booking_datetime: now.toISOString(),
      value_datetime: now.toISOString(),
      metadata: { source: "kang_agent", payment_reference: paymentReference },
    }).catch((e) => console.warn("txn insert failed", e));

    return json(200, {
      success: true,
      new_balance: debitResult.balance_after,
      currency,
      period_end: periodEnd.toISOString(),
      message: "Subscription activated. Enjoy Kang Agent Premium.",
    });
  } catch (e) {
    console.error("kang-wallet-payment error", e);
    return json(500, { success: false, error: "internal_error", detail: (e as Error).message });
  }
});
