// Kang Agent — Unified sync endpoint
// Returns subscription, wallet balance, monthly fee config, and unread notification count.
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
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const [subQ, cfgQ, accQ, notifQ] = await Promise.all([
      admin.from("kang_subscriptions")
        .select("status, questions_asked_count, free_questions_limit, current_period_start, current_period_end, last_payment_status")
        .eq("user_id", userId).maybeSingle(),
      admin.from("kang_config").select("value").eq("key", "monthly_fee").maybeSingle(),
      admin.from("accounts").select("id").eq("user_id", userId).eq("is_active", true).limit(1),
      admin.from("kang_notifications").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("is_read", false),
    ]);

    const cfgValue = (cfgQ.data?.value as any) ?? {};
    const monthlyFee = Number(cfgValue.amount ?? 2000);
    const currency = String(cfgValue.currency ?? "XAF");

    let walletBalance = 0;
    const accountId = accQ.data?.[0]?.id as string | undefined;
    if (accountId) {
      const { data: bal } = await admin
        .from("account_balances")
        .select("amount, currency")
        .eq("account_id", accountId)
        .eq("balance_type", "ClosingAvailable")
        .order("balance_datetime", { ascending: false })
        .limit(1)
        .maybeSingle();
      walletBalance = Number((bal as any)?.amount ?? 0);
    }

    return json(200, {
      success: true,
      subscription: subQ.data ?? {
        status: "trial",
        questions_asked_count: 0,
        free_questions_limit: 5,
        current_period_end: null,
        current_period_start: null,
        last_payment_status: "none",
      },
      wallet: { current_balance: walletBalance, currency },
      config: { monthly_fee: monthlyFee, currency },
      unread_notifications: notifQ.count ?? 0,
    });
  } catch (e) {
    console.error("kang-sync-state error", e);
    return json(500, { success: false, error: "internal_error", detail: (e as Error).message });
  }
});
