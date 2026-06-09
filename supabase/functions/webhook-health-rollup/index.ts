// PERMANENT PUBLIC ROUTES — DO NOT REMOVE OR REDIRECT
// (This is a private service — cron-driven roll-ups for webhook health.)
//
// webhook-health-rollup
// ----------------------
// Aggregates the last 15 minutes of:
//   * youverify_webhook_events  (manual-review / discrepancy / failures)
//   * audit_logs                (*.step_up_denied, *.webhook_correlation_failed)
// and inserts admin_alerts rows when configured thresholds are exceeded.
//
// Intended invocation:
//   * pg_cron every minute (see migration).
//   * Manual GET from /admin/webhook-health "Recompute now" button.
//
// Thresholds (defaults, can be tuned via metadata on admin_alerts rule rows):
//   * webhook_manual_review_spike  : >10 manual-review outcomes in 15 min
//   * step_up_denied_spike         : >10 step-up denials in 15 min
//   * webhook_correlation_failure_spike : >5 session_not_found in 15 min
//
// Alerts are de-duplicated by alert_type within the look-back window so a
// sustained spike does not flood the inbox.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const WINDOW_MINUTES = 15;

interface Threshold {
  alertType: string;
  title: string;
  buildMessage: (count: number) => string;
  severity: "warning" | "critical";
  threshold: number;
}

const THRESHOLDS: Threshold[] = [
  {
    alertType: "webhook_manual_review_spike",
    title: "Manual-review webhook spike",
    buildMessage: (n) => `${n} Youverify webhook events fell back to manual_review/discrepancy in the last ${WINDOW_MINUTES} minutes.`,
    severity: "warning",
    threshold: 10,
  },
  {
    alertType: "step_up_denied_spike",
    title: "Step-up denied spike",
    buildMessage: (n) => `${n} admin step-up MFA challenges were denied in the last ${WINDOW_MINUTES} minutes.`,
    severity: "warning",
    threshold: 10,
  },
  {
    alertType: "webhook_correlation_failure_spike",
    title: "Webhook correlation failures",
    buildMessage: (n) => `${n} Youverify webhook events could not be correlated to a session/KYC row in the last ${WINDOW_MINUTES} minutes.`,
    severity: "critical",
    threshold: 5,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const results: Record<string, number> = {};

  // 1. manual-review webhook outcomes
  const { count: manualReviewCount } = await supabase
    .from("youverify_webhook_events")
    .select("*", { count: "exact", head: true })
    .gte("processed_at", sinceIso)
    .or("outcome.eq.discrepancy,outcome_detail.ilike.%manual_review%");
  results.webhook_manual_review = manualReviewCount ?? 0;

  // 2. correlation failures
  const { count: correlationFailures } = await supabase
    .from("youverify_webhook_events")
    .select("*", { count: "exact", head: true })
    .gte("processed_at", sinceIso)
    .in("outcome", ["session_not_found", "no_session"]);
  results.webhook_correlation_failures = correlationFailures ?? 0;

  // 3. step-up denied via audit_logs
  const { count: stepUpDenied } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso)
    .ilike("action_type", "%.step_up_denied");
  results.step_up_denied = stepUpDenied ?? 0;

  const fired: string[] = [];
  for (const t of THRESHOLDS) {
    const counter =
      t.alertType === "webhook_manual_review_spike" ? results.webhook_manual_review :
      t.alertType === "webhook_correlation_failure_spike" ? results.webhook_correlation_failures :
      results.step_up_denied;
    if (counter < t.threshold) continue;

    // De-dupe: skip if an unack'd alert of this type was created inside the window.
    const { data: existing } = await supabase
      .from("admin_alerts")
      .select("id")
      .eq("alert_type", t.alertType)
      .is("acknowledged_at", null)
      .gte("created_at", sinceIso)
      .limit(1);
    if (existing && existing.length > 0) continue;

    await supabase.from("admin_alerts").insert({
      alert_type: t.alertType,
      severity: t.severity,
      title: t.title,
      message: t.buildMessage(counter),
      metadata: { window_minutes: WINDOW_MINUTES, count: counter, since: sinceIso },
    });
    fired.push(t.alertType);
  }

  return new Response(JSON.stringify({ ok: true, window_minutes: WINDOW_MINUTES, counters: results, alerts_fired: fired }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
