// Kang Agent — Monthly recurring wallet billing cron
// Iterates all active subscriptions whose current_period_end has elapsed and
// re-charges them from the user's Kang wallet. Success extends period 30 days
// (+1 credit); failure suspends the account (-3 credit). Idempotent per user
// per run via a fresh payment_reference UUID.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Fetch fee
  const { data: cfg } = await admin
    .from("kang_config")
    .select("value")
    .eq("key", "monthly_fee")
    .maybeSingle();
  const monthlyFee = Number((cfg?.value as any)?.amount ?? 2000);
  const currency = String((cfg?.value as any)?.currency ?? "XAF");

  const nowIso = new Date().toISOString();

  const { data: due, error: dueErr } = await admin
    .from("kang_subscriptions")
    .select("user_id, current_period_end")
    .eq("status", "active")
    .lte("current_period_end", nowIso);

  if (dueErr) {
    console.error("cron fetch due error", dueErr);
    return json(500, { error: "fetch_due_failed", detail: dueErr.message });
  }

  const rows = due ?? [];
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const userId = row.user_id as string;
    const paymentReference = crypto.randomUUID();

    try {
      const { data: debit } = await admin.rpc("kang_debit_wallet", {
        p_user_id: userId,
        p_amount: monthlyFee,
        p_reference: paymentReference,
      });
      const result = debit as any;

      if (result?.success) {
        const start = new Date();
        const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        await admin.from("kang_subscriptions").update({
          status: "active",
          last_payment_status: "success",
          questions_asked_count: 0,
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
          updated_at: start.toISOString(),
        }).eq("user_id", userId);

        await admin.from("kang_billing_logs").insert({
          user_id: userId,
          payment_reference: paymentReference,
          amount: monthlyFee,
          currency,
          status: "success",
          reason: "Cron: Monthly Subscription Renewed",
          balance_before: result.balance_before,
          balance_after: result.balance_after,
          triggered_by: "cron",
        });

        await admin.from("credit_score_ledger").insert({
          user_id: userId,
          points_change: 1,
          reason: "Monthly Subscription Paid from Wallet (Auto)",
        });
        await admin.rpc("increment_credit_score", { p_user_id: userId, p_delta: 1 }).catch(() => {});

        successCount++;
      } else {
        const currentBalance = Number(result?.current_balance ?? 0);
        const errorCode = String(result?.error ?? "payment_failed");

        // Keep period_end unchanged — user can retry manually
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
          reason: `Cron: ${errorCode}`,
          balance_before: currentBalance,
          balance_after: currentBalance,
          triggered_by: "cron",
        });

        await admin.from("credit_score_ledger").insert({
          user_id: userId,
          points_change: -3,
          reason: "Monthly Subscription Payment Failed - Insufficient Wallet Funds (Auto)",
        });
        await admin.rpc("increment_credit_score", { p_user_id: userId, p_delta: -3 }).catch(() => {});

        failedCount++;
      }
    } catch (e) {
      console.error("cron user error", userId, e);
      failedCount++;
    }
  }

  return json(200, {
    processed_count: rows.length,
    success_count: successCount,
    failed_count: failedCount,
    ran_at: nowIso,
  });
});
