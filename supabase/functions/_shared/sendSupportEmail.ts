// Shared sender for support-team transactional emails.
// Wraps `send-transactional-email` with exponential backoff and writes
// attempt metadata into `email_send_log` so the admin dashboard can
// surface retry counts and the eventual delivery state.
//
// Backoff schedule: 0s, 30s, 2m, 10m, 30m  (max 5 attempts)
// We do not block the caller on retries — the first attempt is awaited
// and any subsequent attempt is enqueued via `next_retry_at` and picked
// up by the `support-email-retry` cron.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const SUPPORT_PORTAL_URL =
  (typeof Deno !== "undefined" && Deno.env.get("SUPPORT_PORTAL_URL")) ||
  "https://info.kangopenbanking.com/support-agent";

export const APP_BASE_URL =
  (typeof Deno !== "undefined" && Deno.env.get("APP_BASE_URL")) ||
  "https://kangopenbanking.com";

export const RETRY_DELAYS_SECONDS = [30, 120, 600, 1800];
export const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;

export interface SupportSendOptions {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * First-attempt send. Awaits the underlying function call once.
 * On failure, schedules a retry by writing next_retry_at into the log.
 */
export async function sendSupportEmail(opts: SupportSendOptions): Promise<{ ok: boolean; error?: string }> {
  const sb = admin();
  const now = new Date().toISOString();

  try {
    const { error } = await sb.functions.invoke("send-transactional-email", {
      body: {
        templateName: opts.templateName,
        recipientEmail: opts.recipientEmail,
        idempotencyKey: opts.idempotencyKey,
        templateData: opts.templateData ?? {},
      },
    });
    if (error) throw error;

    // First-attempt success — stamp attempt metadata if pending row exists.
    await sb
      .from("email_send_log")
      .update({ attempt_count: 1, last_attempt_at: now, next_retry_at: null })
      .eq("message_id", opts.idempotencyKey)
      .eq("status", "pending");
    return { ok: true };
  } catch (e: any) {
    const errMsg = e?.message ?? String(e);
    console.warn(`[sendSupportEmail] attempt 1 failed for ${opts.templateName}:`, errMsg);
    await scheduleRetry(opts, 1, errMsg);
    return { ok: false, error: errMsg };
  }
}

async function scheduleRetry(opts: SupportSendOptions, attempt: number, errorMessage: string) {
  if (attempt >= MAX_ATTEMPTS) return; // give up — leaves status as failed/dlq
  const delaySec = RETRY_DELAYS_SECONDS[attempt - 1];
  const nextAt = new Date(Date.now() + delaySec * 1000).toISOString();

  // Upsert a marker row keyed by idempotencyKey so the cron worker can find it.
  await admin().from("email_send_log").insert({
    message_id: opts.idempotencyKey,
    template_name: opts.templateName,
    recipient_email: opts.recipientEmail,
    status: "pending",
    error_message: errorMessage,
    attempt_count: attempt,
    last_attempt_at: new Date().toISOString(),
    next_retry_at: nextAt,
    metadata: { retryPayload: opts },
  } as any);
}

/**
 * Cron entry point — picks up due retries and re-invokes the sender.
 * Exposed via the `support-email-retry` edge function.
 */
export async function processDueRetries(limit = 25) {
  const sb = admin();
  const { data: due } = await sb
    .from("email_send_log")
    .select("id, message_id, template_name, recipient_email, attempt_count, metadata")
    .eq("status", "pending")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  let attempted = 0;
  let recovered = 0;
  for (const row of (due as any[]) || []) {
    attempted++;
    const payload = (row.metadata?.retryPayload || {}) as SupportSendOptions;
    if (!payload.templateName) continue;
    const nextAttempt = (row.attempt_count || 1) + 1;
    try {
      const { error } = await sb.functions.invoke("send-transactional-email", {
        body: {
          templateName: payload.templateName,
          recipientEmail: payload.recipientEmail || row.recipient_email,
          idempotencyKey: payload.idempotencyKey || row.message_id,
          templateData: payload.templateData ?? {},
        },
      });
      if (error) throw error;
      await sb
        .from("email_send_log")
        .update({
          attempt_count: nextAttempt,
          last_attempt_at: new Date().toISOString(),
          next_retry_at: null,
        })
        .eq("id", row.id);
      recovered++;
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      const giveUp = nextAttempt >= MAX_ATTEMPTS;
      const delaySec = giveUp ? null : RETRY_DELAYS_SECONDS[nextAttempt - 1];
      await sb
        .from("email_send_log")
        .update({
          attempt_count: nextAttempt,
          last_attempt_at: new Date().toISOString(),
          next_retry_at: delaySec ? new Date(Date.now() + delaySec * 1000).toISOString() : null,
          status: giveUp ? "dlq" : "pending",
          error_message: errMsg,
        })
        .eq("id", row.id);
    }
  }
  return { attempted, recovered };
}
