import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import {
  getStripePayoutStatus,
  getFlutterwaveTransferStatus,
  getPayPalPayoutStatus,
} from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * Settlement Cron — Automated 24/7 settlement processor
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Create settlement run record
  await supabase.from("settlement_runs").insert({
    id: runId,
    run_type: "scheduled",
    status: "running",
    started_at: startedAt,
  });

  let processed = 0;
  let settled = 0;
  let failed = 0;
  let totalSettled = 0;
  let totalFees = 0;
  const errors: any[] = [];
  const floatAdj: Record<string, number> = {};

  try {
    // ——— Step 1: Process submitted payouts ———
    const { data: submittedPayouts } = await supabase
      .from("gateway_payouts")
      .select("*, payout_rails!left(rail_code, provider, requires_prefunding)")
      .eq("status", "submitted")
      .order("created_at", { ascending: true })
      .limit(200);

    for (const payout of (submittedPayouts || [])) {
      processed++;

      try {
        const ageMs = Date.now() - new Date(payout.created_at).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        // Auto-fail payouts stuck > 24 hours
        if (ageHours > 24) {
          await failPayout(supabase, payout, "Auto-failed: exceeded 24-hour processing window.", errors);
          failed++;

          // Restore float if prefunded
          if (payout.rail_id && payout.payout_rails?.requires_prefunding) {
            await releaseFloat(supabase, payout.rail_id, payout.currency, payout.amount, "release", payout.id);
            floatAdj[payout.payout_rails.rail_code] = (floatAdj[payout.payout_rails.rail_code] || 0) + payout.amount;
          }
          continue;
        }

        // Simulate provider status check
        // In production, this would call Flutterwave/Stripe/PayPal/Visa Direct APIs
        const providerStatus = await simulateProviderPoll(payout);

        if (providerStatus === "completed") {
          await supabase
            .from("gateway_payouts")
            .update({
              status: "completed",
              provider_raw: {
                ...(payout.provider_raw || {}),
                settled_at: new Date().toISOString(),
                settlement_run_id: runId,
              },
            })
            .eq("id", payout.id);

          settled++;
          totalSettled += payout.amount;
          totalFees += payout.fee_amount || 0;

          // Release reserved float → disbursed
          if (payout.rail_id && payout.payout_rails?.requires_prefunding) {
            await releaseFloat(supabase, payout.rail_id, payout.currency, payout.amount, "disburse", payout.id);
          }

          // Update push-to-card record if applicable
          if (payout.channel === "card_push") {
            await supabase
              .from("push_to_card_transactions")
              .update({ status: "completed", completed_at: new Date().toISOString() })
              .eq("payout_id", payout.id);
          }
        } else if (providerStatus === "failed") {
          await failPayout(supabase, payout, "Provider reported failure.", errors);
          failed++;

          if (payout.rail_id && payout.payout_rails?.requires_prefunding) {
            await releaseFloat(supabase, payout.rail_id, payout.currency, payout.amount, "release", payout.id);
            floatAdj[payout.payout_rails?.rail_code || "unknown"] = 
              (floatAdj[payout.payout_rails?.rail_code || "unknown"] || 0) + payout.amount;
          }
        }
        // else "pending" — leave as-is for next run
      } catch (payoutErr) {
        errors.push({ payout_id: payout.id, error: String(payoutErr) });
      }
    }

    // ——— Step 2: Low-balance alerts ———
    const { data: floats } = await supabase
      .from("treasury_float")
      .select("*, payout_rails!inner(rail_code, is_active)")
      .eq("payout_rails.is_active", true);

    for (const f of (floats || [])) {
      if (f.available_balance <= f.low_balance_threshold) {
        // Check if unresolved alert already exists
        const { data: existing } = await supabase
          .from("treasury_float_alerts")
          .select("id")
          .eq("float_id", f.id)
          .eq("is_resolved", false)
          .limit(1);

        if (!existing || existing.length === 0) {
          const alertType = f.available_balance <= 0 ? "depleted" : "low_balance";
          await supabase.from("treasury_float_alerts").insert({
            float_id: f.id,
            rail_id: f.rail_id,
            alert_type: alertType,
            currency: f.currency,
            current_balance: f.available_balance,
            threshold: f.low_balance_threshold,
          });
        }
      }
    }

    // ——— Step 3: Complete settlement run ———
    const finalStatus = errors.length > 0 && settled > 0 ? "partial" : errors.length > 0 ? "failed" : "completed";

    await supabase
      .from("settlement_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        payouts_processed: processed,
        payouts_settled: settled,
        payouts_failed: failed,
        total_settled_amount: totalSettled,
        total_fees_collected: totalFees,
        float_adjustments: floatAdj,
        error_log: errors,
        summary: {
          duration_ms: Date.now() - new Date(startedAt).getTime(),
          pending_remaining: (submittedPayouts || []).length - settled - failed,
        },
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        run_id: runId,
        status: finalStatus,
        processed,
        settled,
        failed,
        total_settled_amount: totalSettled,
        total_fees_collected: totalFees,
        duration_ms: Date.now() - new Date(startedAt).getTime(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Settlement cron error:", e);

    await supabase
      .from("settlement_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_log: [{ fatal: String(e) }],
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({ error: "Settlement run failed", run_id: runId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ——— Helpers ———

async function failPayout(supabase: any, payout: any, reason: string, errors: any[]) {
  await supabase
    .from("gateway_payouts")
    .update({
      status: "failed",
      failure_reason: reason,
      provider_raw: { ...(payout.provider_raw || {}), failed_at: new Date().toISOString() },
    })
    .eq("id", payout.id);

  // Rollback merchant wallet
  if (payout.merchant_id) {
    const totalDebit = payout.amount + (payout.fee_amount || 0);
    await supabase.rpc("update_merchant_wallet", {
      _merchant_id: payout.merchant_id,
      _currency: payout.currency,
      _available_delta: totalDebit,
      _ledger_delta: totalDebit,
    });
  }

  // Update push-to-card if applicable
  if (payout.channel === "card_push") {
    await supabase
      .from("push_to_card_transactions")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("payout_id", payout.id);
  }

  errors.push({ payout_id: payout.id, reason });
}

async function releaseFloat(
  supabase: any, railId: string, currency: string, amount: number,
  entryType: "release" | "disburse", payoutId: string
) {
  const { data: floatRow } = await supabase
    .from("treasury_float")
    .select("*")
    .eq("rail_id", railId)
    .eq("currency", currency)
    .maybeSingle();

  if (!floatRow) return;

  const balanceBefore = floatRow.available_balance;

  if (entryType === "disburse") {
    // Float was already debited from available during reservation; now move from reserved → disbursed
    await supabase
      .from("treasury_float")
      .update({
        reserved_balance: Math.max(0, floatRow.reserved_balance - amount),
        total_disbursed: floatRow.total_disbursed + amount,
      })
      .eq("id", floatRow.id);
  } else {
    // Release: move reserved back to available (failed payout)
    await supabase
      .from("treasury_float")
      .update({
        available_balance: floatRow.available_balance + amount,
        reserved_balance: Math.max(0, floatRow.reserved_balance - amount),
      })
      .eq("id", floatRow.id);
  }

  // Ledger entry
  await supabase.from("treasury_float_ledger").insert({
    float_id: floatRow.id,
    rail_id: railId,
    currency,
    entry_type: entryType,
    amount: entryType === "release" ? amount : -amount,
    balance_before: balanceBefore,
    balance_after: entryType === "release" ? balanceBefore + amount : balanceBefore,
    reference_type: "payout",
    reference_id: payoutId,
    notes: entryType === "disburse" ? "Payout completed, float disbursed" : "Payout failed, float released",
  });
}

async function simulateProviderPoll(payout: any): Promise<"completed" | "failed" | "pending"> {
  // In production, this calls the actual provider API:
  // - Flutterwave: GET /v3/transfers/{id}
  // - Stripe: GET /v1/payouts/{id}
  // - PayPal: GET /v1/payments/payouts-item/{id}
  // - Visa Direct: GET /visadirect/fundstransfer/v1/pushfundstransactions/{id}
  //
  // For now, simulate based on age:
  const ageMs = Date.now() - new Date(payout.created_at).getTime();
  const ageMinutes = ageMs / (1000 * 60);

  // Instant rails complete quickly
  if (payout.speed === "instant" && ageMinutes > 2) return "completed";
  // Standard rails take longer
  if (payout.speed === "standard" && ageMinutes > 30) return "completed";

  return "pending";
}
