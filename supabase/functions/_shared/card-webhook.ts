// Outbound Card Issuance webhook fan-out helper.
// Mirrors _shared/ptp-webhook.ts — inserts pending rows into `webhook_deliveries`
// so the existing webhook-delivery worker signs (HMAC-SHA256) and POSTs them
// to each institution's registered URL with retry + backoff.
//
// Direct backend mandate — no proxy.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export type CardWebhookEvent =
  | 'card.issue.requested'
  | 'card.issue.persisted'   // <-- the "available" milestone the consumer/app can trust
  | 'card.issue.failed'
  | 'card.frozen'
  | 'card.unfrozen'
  | 'card.terminated';

export interface CardWebhookPayload {
  event: CardWebhookEvent;
  card_id: string;
  user_id: string;
  form_factor?: 'virtual' | 'digital' | 'physical' | null;
  currency?: string | null;
  status?: string | null;
  last4?: string | null;
  idempotency_key?: string | null;
  occurred_at: string;
  data?: Record<string, unknown>;
}

/**
 * Dispatch a card event to every active institution webhook subscribed to it.
 * Non-fatal: errors are logged but never thrown back to the caller.
 */
export async function dispatchCardWebhook(
  admin: Admin,
  event: CardWebhookEvent,
  payload: Omit<CardWebhookPayload, 'event' | 'occurred_at'>,
) {
  try {
    const fullPayload: CardWebhookPayload = {
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
      console.error('[card-webhook] subscriber lookup failed:', error.message);
      return;
    }
    if (!hooks || hooks.length === 0) return;

    // Trace-id makes retries idempotent per subscriber for the same logical event.
    const rows = hooks.map((h: any) => ({
      webhook_id: h.id,
      event_type: event,
      event_data: fullPayload as unknown as Record<string, unknown>,
      status: 'pending',
      attempt_count: 0,
      trace_id: `card:${event}:${payload.card_id}:${h.id}`,
    }));

    const traceIds = rows.map((r) => r.trace_id);
    const { data: existing } = await admin
      .from('webhook_deliveries')
      .select('trace_id')
      .in('trace_id', traceIds);
    const seen = new Set((existing ?? []).map((r: any) => r.trace_id));
    const toInsert = rows.filter((r) => !seen.has(r.trace_id));
    if (toInsert.length === 0) return;

    const { error: insErr } = await admin.from('webhook_deliveries').insert(toInsert);
    if (insErr) console.error('[card-webhook] queue failed:', insErr.message);
  } catch (e) {
    console.error('[card-webhook] unexpected:', (e as Error).message);
  }
}
