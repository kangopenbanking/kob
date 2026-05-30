// Cron-driven email queue health monitor.
// Detects:
//   1. DLQ growth — > N new DLQ rows in the last hour
//   2. Backlog — > N rows still 'pending' older than 30 minutes
//   3. Send failure spike — failure rate > 25% in the last hour (min 8 sends)
//
// On detection:
//   - Inserts a row into public.admin_alerts (deduped by alert_type per hour).
//   - Sends a notification email to all admin users via send-transactional-email
//     using the new 'admin-email-queue-alert' template.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DLQ_THRESHOLD = 5;        // > 5 DLQ rows in last 1h triggers alert
const BACKLOG_THRESHOLD = 25;   // > 25 pending older than 30min triggers alert
const FAILURE_RATE_THRESHOLD = 0.25;
const FAILURE_MIN_SAMPLE = 8;
const BOUNCE_RATE_THRESHOLD = 0.05;   // > 5% bounce rate over 24h
const BOUNCE_MIN_SAMPLE = 20;


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // ---- 1. DLQ growth check ----
    const { count: dlqCount } = await admin
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "dlq")
      .gte("created_at", oneHourAgo);

    // ---- 2. Backlog check ----
    const { count: backlogCount } = await admin
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", thirtyMinAgo);

    // ---- 3. Failure rate ----
    const { data: recentSends } = await admin
      .from("email_send_log")
      .select("status")
      .gte("created_at", oneHourAgo)
      .in("status", ["sent", "dlq", "failed"]);
    const total = recentSends?.length || 0;
    const failures = (recentSends || []).filter((r) => r.status !== "sent").length;
    const failureRate = total > 0 ? failures / total : 0;

    // ---- 4. Bounce / complaint rate over last 24h ----
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: deliveryWindow } = await admin
      .from("email_send_log")
      .select("status")
      .gte("created_at", twentyFourHoursAgo)
      .in("status", ["sent", "bounced", "complained"]);
    const deliveryTotal = deliveryWindow?.length || 0;
    const bounces = (deliveryWindow || []).filter((r) => r.status === "bounced").length;
    const complaints = (deliveryWindow || []).filter((r) => r.status === "complained").length;
    const bounceRate = deliveryTotal > 0 ? (bounces + complaints) / deliveryTotal : 0;

    const triggered: string[] = [];


    async function fire(type: string, severity: "warning" | "critical", title: string, message: string, metadata: any) {
      // Dedupe: skip if same alert_type fired in the last hour.
      const { data: existing } = await admin
        .from("admin_alerts")
        .select("id")
        .eq("alert_type", type)
        .gte("created_at", oneHourAgo)
        .limit(1)
        .maybeSingle();
      if (existing) return;

      await admin.from("admin_alerts").insert({
        alert_type: type,
        severity,
        title,
        message,
        metadata,
      });

      // Notify admins by email (best-effort, non-blocking on failure).
      try {
        const { data: adminRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin" as any);
        const adminIds = (adminRoles || []).map((r: any) => r.user_id);
        if (adminIds.length === 0) return;

        const { data: adminProfiles } = await admin
          .from("profiles")
          .select("email, full_name")
          .in("id", adminIds);

        for (const p of adminProfiles || []) {
          if (!p.email) continue;
          await admin.functions.invoke("send-transactional-email", {
            headers: { Authorization: `Bearer ${SERVICE_KEY}` },
            body: {
              templateName: "admin-email-queue-alert",
              recipientEmail: p.email,
              idempotencyKey: `email-alert-${type}-${new Date().toISOString().slice(0, 13)}-${p.email}`,
              templateData: {
                adminName: p.full_name || p.email.split("@")[0],
                alertTitle: title,
                alertMessage: message,
                severity,
                metadata,
                dashboardUrl: "https://info.kangfintechsolutions.com/admin/invite-email-history",
              },
            },
          });
        }
      } catch (e) {
        console.warn("Failed to notify admins by email", e);
      }

      triggered.push(type);
    }

    if ((dlqCount || 0) > DLQ_THRESHOLD) {
      await fire(
        "email_dlq_growth",
        "critical",
        "Email dead-letter queue is growing",
        `${dlqCount} emails moved to the dead-letter queue in the last hour (threshold: ${DLQ_THRESHOLD}). Investigate the provider or template configuration immediately.`,
        { dlq_count: dlqCount, window: "1h", threshold: DLQ_THRESHOLD },
      );
    }

    if ((backlogCount || 0) > BACKLOG_THRESHOLD) {
      await fire(
        "email_queue_backlog",
        "warning",
        "Email queue backlog detected",
        `${backlogCount} emails have been pending for more than 30 minutes (threshold: ${BACKLOG_THRESHOLD}). The queue dispatcher may be stalled or rate-limited.`,
        { backlog_count: backlogCount, age_minutes: 30, threshold: BACKLOG_THRESHOLD },
      );
    }

    if (total >= FAILURE_MIN_SAMPLE && failureRate > FAILURE_RATE_THRESHOLD) {
      await fire(
        "email_send_failure_spike",
        "critical",
        "Email send failure rate is high",
        `${(failureRate * 100).toFixed(1)}% of emails failed in the last hour (${failures}/${total}, threshold: ${(FAILURE_RATE_THRESHOLD * 100).toFixed(0)}%).`,
        { failure_rate: failureRate, failures, total, window: "1h" },
      );
    }

    return json({
      success: true,
      checked_at: new Date().toISOString(),
      metrics: {
        dlq_last_hour: dlqCount || 0,
        backlog_over_30min: backlogCount || 0,
        sends_last_hour: total,
        failure_rate: failureRate,
      },
      alerts_fired: triggered,
    });
  } catch (e: any) {
    console.error("email-queue-alerts error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
