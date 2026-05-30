// woocommerce-reconciliation
// Scheduled job that compares gateway_charges vs woocommerce_transactions for
// the last N hours and flags mismatches in reconciliation_mismatches for admin
// review. Invoked by pg_cron on a schedule; also runnable on-demand by admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const MAP: Record<string, string> = {
  success: "completed", succeeded: "completed", completed: "completed", paid: "completed",
  failed: "failed", cancelled: "failed", canceled: "failed",
  refunded: "refunded", partially_refunded: "refunded",
  processing: "processing", authorized: "processing",
};
const norm = (s: string) => MAP[(s || "").toLowerCase()] || "pending";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: either service-role bearer (cron) or admin user.
  const auth = req.headers.get("authorization") || "";
  const isService = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  let initiatedBy: string | null = null;
  if (!isService) {
    const { data: { user } } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    initiatedBy = user.id;
  }

  const body = await req.json().catch(() => ({}));
  const hours = Math.max(1, Math.min(720, Number(body.hours) || 24));
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - hours * 3600_000);

  // Create run row
  const { data: run, error: runErr } = await supabase
    .from("reconciliation_runs")
    .insert({
      run_type: "woocommerce_vs_gateway",
      provider: "woocommerce",
      status: "running",
      started_at: new Date().toISOString(),
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      initiated_by: initiatedBy,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    return new Response(JSON.stringify({ error: "run_create_failed", detail: runErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Pull woocommerce_transactions within window
  const { data: wooTxs = [] } = await supabase
    .from("woocommerce_transactions")
    .select("id, transaction_ref, status, amount, currency, kob_transaction_id, merchant_id")
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  let matched = 0, mismatched = 0, missingPlatform = 0, amountDelta = 0;
  const mismatches: any[] = [];

  for (const wt of wooTxs!) {
    let charge: any = null;
    if (wt.kob_transaction_id) {
      const { data } = await supabase
        .from("gateway_charges")
        .select("id, status, amount, currency, tx_ref")
        .eq("id", wt.kob_transaction_id)
        .maybeSingle();
      charge = data;
    }
    if (!charge) {
      const { data } = await supabase
        .from("gateway_charges")
        .select("id, status, amount, currency, tx_ref")
        .eq("tx_ref", wt.transaction_ref)
        .maybeSingle();
      charge = data;
    }

    if (!charge) {
      missingPlatform++;
      mismatches.push({
        run_id: run.id,
        mismatch_type: "missing_on_provider",
        entity_type: "woocommerce_transaction",
        entity_id: wt.id,
        provider_ref: wt.transaction_ref,
        platform_status: wt.status,
        platform_amount: wt.amount,
        platform_currency: wt.currency,
        details: { merchant_id: wt.merchant_id },
      });
      continue;
    }

    const expected = norm(charge.status);
    const amtDelta = Math.abs(Number(charge.amount) - Number(wt.amount));
    const sameStatus = expected === wt.status;
    const sameAmount = amtDelta < 0.01;
    const sameCurrency = (charge.currency || "").toUpperCase() === (wt.currency || "").toUpperCase();

    if (sameStatus && sameAmount && sameCurrency) {
      matched++;
    } else {
      mismatched++;
      amountDelta += amtDelta;
      mismatches.push({
        run_id: run.id,
        mismatch_type: !sameStatus ? "status_mismatch" : (!sameAmount ? "amount_mismatch" : "currency_mismatch"),
        entity_type: "woocommerce_transaction",
        entity_id: wt.id,
        provider_ref: charge.tx_ref || wt.transaction_ref,
        platform_status: wt.status,
        provider_status: expected,
        platform_amount: wt.amount,
        provider_amount: charge.amount,
        platform_currency: wt.currency,
        provider_currency: charge.currency,
        details: { merchant_id: wt.merchant_id, gateway_charge_id: charge.id },
      });
    }
  }

  if (mismatches.length) {
    await supabase.from("reconciliation_mismatches").insert(mismatches);
  }

  await supabase
    .from("reconciliation_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_platform_records: wooTxs!.length,
      matched_count: matched,
      mismatched_count: mismatched,
      missing_on_provider: missingPlatform,
      amount_discrepancy: amountDelta.toFixed(2),
      summary: { hours, source: "woocommerce" },
    })
    .eq("id", run.id);

  return new Response(
    JSON.stringify({
      success: true,
      run_id: run.id,
      total: wooTxs!.length,
      matched,
      mismatched,
      missing_on_provider: missingPlatform,
      amount_discrepancy: amountDelta.toFixed(2),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
