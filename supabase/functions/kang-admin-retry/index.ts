// Kang Agent — Admin manual retry
// Admin-only. Re-runs wallet deduction for a specified user's suspended/failed subscription.
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
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { success: false, error: "missing_token" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !userRes?.user) return json(401, { success: false, error: "invalid_token" });
    const callerId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json(403, { success: false, error: "not_admin" });

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.user_id ?? "");
    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return json(400, { success: false, error: "invalid_user_id" });
    }

    const { data: cfg } = await admin.from("kang_config").select("value").eq("key", "monthly_fee").maybeSingle();
    const monthlyFee = Number((cfg?.value as any)?.amount ?? 2000);
    const currency = String((cfg?.value as any)?.currency ?? "XAF");

    const paymentReference = crypto.randomUUID();
    const { data: debit, error: debitErr } = await admin.rpc("kang_debit_wallet", {
      p_user_id: targetUserId,
      p_amount: monthlyFee,
      p_reference: paymentReference,
    });
    if (debitErr) return json(500, { success: false, error: "debit_rpc_failed", detail: debitErr.message });

    const result = debit as any;
    const now = new Date();

    if (result?.success) {
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await admin.from("kang_subscriptions").update({
        status: "active",
        last_payment_status: "success",
        questions_asked_count: 0,
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        updated_at: now.toISOString(),
      }).eq("user_id", targetUserId);

      await admin.from("kang_billing_logs").insert({
        user_id: targetUserId,
        payment_reference: paymentReference,
        amount: monthlyFee,
        currency,
        status: "success",
        reason: "Admin manual retry — success",
        balance_before: result.balance_before,
        balance_after: result.balance_after,
        triggered_by: "cron",
      });

      await admin.from("kang_notifications").insert({
        user_id: targetUserId,
        type: "payment_success",
        title: "Subscription reactivated",
        message: "An administrator has reactivated your Kang Agent Premium subscription.",
      });

      return json(200, { success: true, new_balance: result.balance_after, currency });
    }

    const currentBalance = Number(result?.current_balance ?? 0);
    const errorCode = String(result?.error ?? "payment_failed");

    await admin.from("kang_billing_logs").insert({
      user_id: targetUserId,
      payment_reference: paymentReference,
      amount: monthlyFee,
      currency,
      status: "failed",
      reason: `Admin retry: ${errorCode}`,
      balance_before: currentBalance,
      balance_after: currentBalance,
      triggered_by: "cron",
    });

    return json(200, { success: false, error: errorCode, current_balance: currentBalance, currency });
  } catch (e) {
    return json(500, { success: false, error: "internal_error", detail: (e as Error).message });
  }
});
