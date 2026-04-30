// Slice 6 — Webhook Inbox Retry Worker
// Cron-driven. Picks unprocessed webhook_inbox rows whose next_retry_at <= now(),
// applies capped exponential backoff, and moves rows to webhook_inbox_dlq when
// attempt_count >= max_attempts.
//
// Trigger via cron with header `x-cron-secret: $CRON_SECRET`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { verifyCronAuth } from '../_shared/cron-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BATCH_LIMIT = 50;
const BASE_BACKOFF_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 3600;

function backoff(attempt: number): number {
  return Math.min(BASE_BACKOFF_SECONDS * Math.pow(2, attempt), MAX_BACKOFF_SECONDS);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Map provider/source → reprocessing edge function.
const SOURCE_TO_FUNCTION: Record<string, string> = {
  flutterwave: 'gateway-webhook-flutterwave',
  paypal: 'gateway-webhook-paypal',
  stripe: 'gateway-webhook-stripe',
  woocommerce: 'pos-woo-webhook-ingestion',
  bank: 'bank-transaction-webhook',
};

async function reprocess(source: string, payload: unknown, signature: string | null) {
  const fn = SOURCE_TO_FUNCTION[source];
  if (!fn) return { ok: false, error: `no_handler_for_source:${source}` };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        'X-Webhook-Replay': 'true',
        ...(signature ? { 'X-Webhook-Signature': signature } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `${res.status}:${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary = { picked: 0, succeeded: 0, rescheduled: 0, dead_lettered: 0, errors: 0 };

  const { data: rows, error } = await admin
    .from('webhook_inbox')
    .select('id, source, payload, signature, attempt_count, max_attempts')
    .eq('is_processed', false)
    .neq('status', 'failed_permanently')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (error) return json({ error: error.message }, 500);
  if (!rows || rows.length === 0) {
    return json({ ok: true, summary, message: 'no due rows' });
  }
  summary.picked = rows.length;

  for (const row of rows) {
    const nextAttempt = (row.attempt_count ?? 0) + 1;
    const result = await reprocess(row.source, row.payload, row.signature);

    if (result.ok) {
      await admin.from('webhook_inbox').update({
        is_processed: true,
        processed_at: new Date().toISOString(),
        attempt_count: nextAttempt,
        status: 'processed',
        processing_error: null,
      }).eq('id', row.id);
      summary.succeeded++;
    } else if (nextAttempt >= (row.max_attempts ?? 5)) {
      const { error: dlqErr } = await admin.rpc('move_webhook_to_dlq', {
        p_inbox_id: row.id,
        p_reason: result.error?.slice(0, 500) ?? 'unknown_error',
      });
      if (dlqErr) {
        summary.errors++;
      } else {
        summary.dead_lettered++;
      }
    } else {
      await admin.from('webhook_inbox').update({
        attempt_count: nextAttempt,
        next_retry_at: new Date(Date.now() + backoff(nextAttempt) * 1000).toISOString(),
        processing_error: result.error?.slice(0, 500),
        status: 'retrying',
      }).eq('id', row.id);
      summary.rescheduled++;
    }
  }

  return json({ ok: true, summary });
});
