// Outbound PTP webhook fan-out helper.
// Inserts pending rows into `webhook_deliveries`; the existing
// `webhook-delivery` cron worker signs them with HMAC-SHA256 and POSTs them
// to each institution's registered URL with retry + backoff.
//
// Direct backend mandate — no proxy. Worker URL:
//   https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/webhook-delivery
import { createClient } from 'npm:@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export type PtpWebhookEvent =
  | 'ptp.created'
  | 'ptp.partial'
  | 'ptp.rescheduled'
  | 'ptp.kept'
  | 'ptp.broken'
  | 'ptp.swept'
  | 'ptp.cancelled'
  | 'ptp.fee_charged'
  | 'ptp.fee_waived';

export interface PtpWebhookPayload {
  event: PtpWebhookEvent;
  promise_id: string;
  user_id: string;
  loan_account_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  promised_date?: string | null;
  status?: string | null;
  occurred_at: string;
  data?: Record<string, unknown>;
}

/**
 * Dispatch a PTP event to every active institution webhook subscribed to it.
 * Non-fatal: errors are logged but never thrown back to the caller.
 */
export async function dispatchPtpWebhook(
  admin: Admin,
  event: PtpWebhookEvent,
  payload: Omit<PtpWebhookPayload, 'event' | 'occurred_at'>,
) {
  try {
    const fullPayload: PtpWebhookPayload = {
      event,
      occurred_at: new Date().toISOString(),
      ...payload,
    };

    const { data: hooks, error } = await admin
      .from('webhooks')
      .select('id, events, is_active')
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) {
      console.error('[ptp-webhook] subscriber lookup failed:', error.message);
      return;
    }
    if (!hooks || hooks.length === 0) return;

    const rows = hooks.map((h: any) => ({
      webhook_id: h.id,
      event_type: event,
      event_data: fullPayload as unknown as Record<string, unknown>,
      status: 'pending',
      attempt_count: 0,
      // Stable trace/request ID — dedupes retries of the same logical event
      // per subscriber so notification + credit writes downstream stay idempotent.
      trace_id: `ptp:${event}:${payload.promise_id}:${h.id}`,
    }));

    // Skip rows already queued/delivered for the same trace_id (idempotency).
    const traceIds = rows.map((r) => r.trace_id);
    const { data: existing } = await admin
      .from('webhook_deliveries')
      .select('trace_id')
      .in('trace_id', traceIds);
    const seen = new Set((existing ?? []).map((r: any) => r.trace_id));
    const toInsert = rows.filter((r) => !seen.has(r.trace_id));
    if (toInsert.length === 0) return;

    const { error: insErr } = await admin.from('webhook_deliveries').insert(toInsert);
    if (insErr) console.error('[ptp-webhook] queue failed:', insErr.message);
  } catch (e) {
    console.error('[ptp-webhook] unexpected:', (e as Error).message);
  }
}
