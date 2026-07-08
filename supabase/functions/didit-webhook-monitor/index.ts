// Didit webhook resilience monitor.
//
// Runs on a cron (every 2 minutes). Two responsibilities:
//
// 1. Retry any didit_webhook_events row with processed=false and
//    next_retry_at <= now(), using exponential backoff. Marks processed on
//    success or increments retry_count on failure. After 7 attempts fires a
//    critical admin alert (dedupe: alerted_at set once).
//
// 2. Detect duplicate storms — sum(duplicate_count) in the last 15 minutes
//    above threshold triggers a warning alert. Also flag any "stale
//    unprocessed" (received >10 min ago, still processed=false) rows once.
//
// Alerts land in admin_alerts and email every admin via
// send-transactional-email (template: admin-email-queue-alert, reused).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { applyDiditEvent } from "../didit-webhook/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RETRIES = 7;
const BATCH_SIZE = 25;
const DUPLICATE_STORM_WINDOW_MIN = 15;
const DUPLICATE_STORM_THRESHOLD = 25;
const STALE_UNPROCESSED_MIN = 10;

function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "didit-webhook-monitor", ...entry }));
}

// Exponential backoff: 30s, 1m, 2m, 5m, 10m, 30m, 1h
function nextBackoffMs(retryCount: number): number {
  const schedule = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000];
  return schedule[Math.min(retryCount, schedule.length - 1)];
}

async function fireAlert(
  admin: ReturnType<typeof createClient>,
  args: {
    type: string;
    severity: "warning" | "critical";
    title: string;
    message: string;
    metadata: Record<string, unknown>;
    dedupeWindowMin?: number;
  },
) {
  const dedupeWindow = args.dedupeWindowMin ?? 60;
  const cutoff = new Date(Date.now() - dedupeWindow * 60_000).toISOString();
  const { data: existing } = await admin
    .from("admin_alerts")
    .select("id")
    .eq("alert_type", args.type)
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (existing) return false;

  await admin.from("admin_alerts").insert({
    alert_type: args.type,
    severity: args.severity,
    title: args.title,
    message: args.message,
    metadata: args.metadata,
  });

  try {
    const { data: adminRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin" as any);
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);
    if (adminIds.length === 0) return true;

    const { data: adminProfiles } = await admin
      .from("profiles")
      .select("email, full_name")
      .in("id", adminIds);

    const SYNTHETIC = ["@phone.kob.cm", "@kang.id", "@no-email.local", ".local"];
    const candidates = (adminProfiles || [])
      .map((p: any) => ({ email: (p.email || "").toLowerCase().trim(), full_name: p.full_name }))
      .filter((p) => p.email && p.email.includes("@") && !SYNTHETIC.some((s) => p.email.endsWith(s)));

    let suppressedSet = new Set<string>();
    if (candidates.length) {
      const { data: suppressed } = await admin
        .from("suppressed_emails")
        .select("email")
        .in("email", candidates.map((p) => p.email));
      suppressedSet = new Set((suppressed || []).map((s: any) => (s.email || "").toLowerCase()));
    }
    const deliverable = candidates.filter((p) => !suppressedSet.has(p.email));

    for (const p of deliverable) {
      await admin.functions.invoke("send-transactional-email", {
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
        body: {
          templateName: "admin-email-queue-alert",
          recipientEmail: p.email,
          idempotencyKey: `didit-alert-${args.type}-${new Date().toISOString().slice(0, 13)}-${p.email}`,
          templateData: {
            adminName: p.full_name || p.email.split("@")[0],
            alertTitle: args.title,
            alertMessage: args.message,
            severity: args.severity,
            metadata: args.metadata,
            dashboardUrl: "https://info.kangfintechsolutions.com/admin/kyc-monitor",
          },
        },
      });
    }
  } catch (e) {
    log({ event: "email_notify_failed", error: (e as Error).message });
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = new Date().toISOString();
  const { data: due, error: dueErr } = await admin
    .from("didit_webhook_events")
    .select("event_id, webhook_type, session_id, vendor_data, status, workflow_id, payload, retry_count")
    .eq("processed", false)
    .lt("retry_count", MAX_RETRIES)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("received_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (dueErr) {
    log({ event: "fetch_due_failed", error: dueErr.message });
    return new Response(JSON.stringify({ ok: false, error: dueErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { attempted: due?.length ?? 0, succeeded: 0, failed: 0, exhausted: 0 };

  for (const row of due || []) {
    const outcome = await applyDiditEvent(admin, {
      eventId: row.event_id as string,
      webhookType: row.webhook_type as string,
      status: (row.status as string | null) ?? null,
      effectiveSessionId: (row.session_id as string | null) ?? null,
      vendorData: (row.vendor_data as string | null) ?? null,
      workflowId: (row.workflow_id as string | null) ?? null,
      parsed: (row.payload as Record<string, unknown>) ?? {},
    });

    if (outcome.ok) {
      await admin
        .from("didit_webhook_events")
        .update({
          processed: true,
          processing_error: null,
          processed_at: new Date().toISOString(),
          next_retry_at: null,
          last_retry_at: new Date().toISOString(),
        })
        .eq("event_id", row.event_id);
      results.succeeded++;
    } else {
      const nextCount = (row.retry_count as number) + 1;
      const exhausted = nextCount >= MAX_RETRIES;
      await admin
        .from("didit_webhook_events")
        .update({
          retry_count: nextCount,
          last_retry_at: new Date().toISOString(),
          last_error: outcome.error,
          processing_error: outcome.error,
          next_retry_at: exhausted ? null : new Date(Date.now() + nextBackoffMs(nextCount)).toISOString(),
        })
        .eq("event_id", row.event_id);
      results.failed++;
      if (exhausted) results.exhausted++;
    }
  }

  // Alert on exhausted rows that have not yet been alerted.
  const { data: exhausted } = await admin
    .from("didit_webhook_events")
    .select("event_id, session_id, vendor_data, webhook_type, last_error, retry_count, received_at")
    .eq("processed", false)
    .gte("retry_count", MAX_RETRIES)
    .is("alerted_at", null)
    .limit(50);

  if (exhausted && exhausted.length > 0) {
    const fired = await fireAlert(admin, {
      type: "didit_webhook_processing_exhausted",
      severity: "critical",
      title: `${exhausted.length} Didit webhook event(s) failed after ${MAX_RETRIES} retries`,
      message:
        `Didit KYC events could not be reconciled with kyc_verifications after ${MAX_RETRIES} attempts. ` +
        `Manual review required — affected sessions may show stale KYC status in the app.`,
      metadata: {
        exhausted_count: exhausted.length,
        sample: exhausted.slice(0, 10),
      },
      dedupeWindowMin: 60,
    });
    if (fired) {
      await admin
        .from("didit_webhook_events")
        .update({ alerted_at: new Date().toISOString() })
        .in("event_id", exhausted.map((r) => r.event_id));
    }
  }

  // Duplicate storm detection.
  const dupCutoff = new Date(Date.now() - DUPLICATE_STORM_WINDOW_MIN * 60_000).toISOString();
  const { data: dupRows } = await admin
    .from("didit_webhook_events")
    .select("duplicate_count")
    .gte("last_duplicate_at", dupCutoff);
  const dupTotal = (dupRows || []).reduce((s: number, r: any) => s + ((r.duplicate_count as number) || 0), 0);
  if (dupTotal >= DUPLICATE_STORM_THRESHOLD) {
    await fireAlert(admin, {
      type: "didit_webhook_duplicate_storm",
      severity: "warning",
      title: "Didit is redelivering webhook events at an elevated rate",
      message:
        `${dupTotal} duplicate Didit webhook deliveries were observed in the last ${DUPLICATE_STORM_WINDOW_MIN} minutes ` +
        `(threshold: ${DUPLICATE_STORM_THRESHOLD}). Signature checks passed — verify the webhook receiver is returning 2xx promptly.`,
      metadata: {
        duplicate_total: dupTotal,
        window_minutes: DUPLICATE_STORM_WINDOW_MIN,
        threshold: DUPLICATE_STORM_THRESHOLD,
      },
      dedupeWindowMin: 60,
    });
  }

  // Stale unprocessed alert (single row, e.g. a very old event that keeps
  // failing before it hits MAX_RETRIES).
  const staleCutoff = new Date(Date.now() - STALE_UNPROCESSED_MIN * 60_000).toISOString();
  const { count: staleCount } = await admin
    .from("didit_webhook_events")
    .select("event_id", { count: "exact", head: true })
    .eq("processed", false)
    .lt("received_at", staleCutoff);
  if ((staleCount ?? 0) >= 10) {
    await fireAlert(admin, {
      type: "didit_webhook_backlog",
      severity: "warning",
      title: `${staleCount} Didit webhook events pending for over ${STALE_UNPROCESSED_MIN} minutes`,
      message:
        `The didit-webhook-monitor retry queue has ${staleCount} unprocessed events older than ${STALE_UNPROCESSED_MIN} minutes. ` +
        `Check the edge function logs for repeated errors.`,
      metadata: { pending_count: staleCount, age_minutes: STALE_UNPROCESSED_MIN },
      dedupeWindowMin: 60,
    });
  }

  log({ event: "run_complete", ...results, duplicate_total_15m: dupTotal, stale_backlog: staleCount ?? 0 });

  return new Response(
    JSON.stringify({ ok: true, ...results, duplicate_total_15m: dupTotal, stale_backlog: staleCount ?? 0 }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
