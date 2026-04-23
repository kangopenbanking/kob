// Automated DLQ re-delivery for invite & support emails.
// Cron-driven. Picks DLQ rows from the last 7 days that have NOT been
// re-delivered yet, generates a fresh idempotency key (so the queue
// dedup guard doesn't suppress us), re-invokes send-transactional-email,
// and records the attempt in email_dlq_redeliveries.
//
// Safety guards:
//   - Only re-delivers eligible templates (configurable allowlist).
//   - Skips recipients in the suppression list.
//   - Caps redelivery_attempt at 3 per original message_id.
//   - Skips if a successful redelivery already exists for the same key.
//   - Skips if a manual successful send for the same recipient+template
//     happened after the DLQ entry (already resolved).
//
// Triggered by:
//   - pg_cron every 15 minutes (server-side)
//   - Admin "Retry now" button via POST { triggered_by: 'admin', user_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates that are safe to auto-redeliver. Anything time-sensitive
// (OTP, magic-link) is intentionally excluded.
const ELIGIBLE_TEMPLATES = new Set([
  "support-agent-invite",
  "support-new-chat-agent",
  "managed-support_agent_invite",
  "invite",
  "welcome",
  "merchant-onboarded",
  "kyc-status-update",
  "loan-status-update",
  "payment-confirmation",
  "payment-received",
  "statement-ready",
  "customer-invoice",
]);

const MAX_REDELIVERY_ATTEMPTS = 3;
const LOOKBACK_HOURS = 24 * 7; // 7 days

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

  // Parse optional body for admin-triggered single redelivery.
  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }

  const isAdminTriggered = body?.triggered_by === "admin";
  const targetMessageId = body?.message_id as string | undefined;
  const triggeredByUser = body?.user_id as string | undefined;

  try {
    // 1. Fetch eligible DLQ rows.
    const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();

    let query = admin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, error_message, metadata, created_at")
      .eq("status", "dlq")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (targetMessageId) {
      query = query.eq("message_id", targetMessageId);
    }

    const { data: dlqRows, error: dlqErr } = await query.limit(isAdminTriggered ? 5 : 50);
    if (dlqErr) throw dlqErr;

    let attempted = 0;
    let queued = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const row of dlqRows || []) {
      const tpl = row.template_name || "";
      // Eligibility check
      if (!ELIGIBLE_TEMPLATES.has(tpl) && !tpl.startsWith("support-") && !tpl.startsWith("managed-support_")) {
        skipped++;
        continue;
      }

      // Already redelivered successfully?
      const { data: prevRedeliveries } = await admin
        .from("email_dlq_redeliveries")
        .select("id, redelivery_attempt, result_status")
        .eq("original_message_id", row.message_id)
        .order("created_at", { ascending: false });

      const successfulRedelivery = prevRedeliveries?.find((r) => r.result_status === "queued");
      if (successfulRedelivery && !isAdminTriggered) {
        skipped++;
        continue;
      }

      const attemptNumber = (prevRedeliveries?.length || 0) + 1;
      if (attemptNumber > MAX_REDELIVERY_ATTEMPTS && !isAdminTriggered) {
        skipped++;
        continue;
      }

      // Has a successful send for the same recipient+template happened after the DLQ?
      const { data: recentSuccess } = await admin
        .from("email_send_log")
        .select("id")
        .eq("recipient_email", row.recipient_email)
        .eq("template_name", tpl)
        .eq("status", "sent")
        .gte("created_at", row.created_at)
        .limit(1)
        .maybeSingle();
      if (recentSuccess) {
        skipped++;
        // Record as superseded so we don't re-evaluate next cycle
        await admin.from("email_dlq_redeliveries").insert({
          original_message_id: row.message_id,
          new_message_id: `superseded-${row.message_id}`,
          template_name: tpl,
          recipient_email: row.recipient_email,
          redelivery_attempt: attemptNumber,
          triggered_by: isAdminTriggered ? "admin" : "cron",
          triggered_by_user: triggeredByUser ?? null,
          result_status: "queued",
          error_message: "Already delivered after DLQ — skipped",
        });
        continue;
      }

      // Suppressed?
      const { data: suppressed } = await admin
        .from("suppressed_emails")
        .select("id")
        .eq("email", row.recipient_email.toLowerCase())
        .maybeSingle();
      if (suppressed) {
        skipped++;
        await admin.from("email_dlq_redeliveries").insert({
          original_message_id: row.message_id,
          new_message_id: `suppressed-${row.message_id}`,
          template_name: tpl,
          recipient_email: row.recipient_email,
          redelivery_attempt: attemptNumber,
          triggered_by: isAdminTriggered ? "admin" : "cron",
          triggered_by_user: triggeredByUser ?? null,
          result_status: "failed",
          error_message: "Recipient is on the suppression list",
        });
        continue;
      }

      // Build a fresh idempotency key (timestamp suffix breaks dedup).
      const newKey = `${row.message_id}__redeliver-${Date.now()}-${attemptNumber}`;

      // Recover original templateData from the metadata payload if present
      const templateData =
        (row.metadata as any)?.retryPayload?.templateData ??
        (row.metadata as any)?.templateData ??
        {};

      attempted++;
      try {
        const { data: invokeData, error: invokeErr } = await admin.functions.invoke(
          "send-transactional-email",
          {
            body: {
              templateName: tpl,
              recipientEmail: row.recipient_email,
              idempotencyKey: newKey,
              templateData,
            },
          },
        );
        if (invokeErr) throw invokeErr;

        await admin.from("email_dlq_redeliveries").insert({
          original_message_id: row.message_id,
          new_message_id: newKey,
          template_name: tpl,
          recipient_email: row.recipient_email,
          redelivery_attempt: attemptNumber,
          triggered_by: isAdminTriggered ? "admin" : "cron",
          triggered_by_user: triggeredByUser ?? null,
          result_status: "queued",
        });
        queued++;
        results.push({ message_id: row.message_id, recipient: row.recipient_email, status: "queued", new_key: newKey });
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        await admin.from("email_dlq_redeliveries").insert({
          original_message_id: row.message_id,
          new_message_id: newKey,
          template_name: tpl,
          recipient_email: row.recipient_email,
          redelivery_attempt: attemptNumber,
          triggered_by: isAdminTriggered ? "admin" : "cron",
          triggered_by_user: triggeredByUser ?? null,
          result_status: "failed",
          error_message: errMsg,
        });
        results.push({ message_id: row.message_id, recipient: row.recipient_email, status: "failed", error: errMsg });
      }
    }

    return json({
      success: true,
      scanned: dlqRows?.length || 0,
      attempted,
      queued,
      skipped,
      results: isAdminTriggered ? results : undefined,
    });
  } catch (e: any) {
    console.error("email-dlq-redelivery error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
