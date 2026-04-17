// Wave 5C — bank-retry-worker
// Cron-driven worker that replays failed bank operations from `bank_retry_queue`.
// Picks pending rows whose next_attempt_at <= now(), invokes the matching edge
// function, and applies capped exponential backoff. Marks rows as `dead_letter`
// after max_attempts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { computeBackoff } from '../_shared/bank-connectors/retry-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BATCH_LIMIT = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Map operation → edge function name
const OPERATION_TO_FUNCTION: Record<string, string> = {
  'poll_transactions': 'bank-data-poller',
  'poll_balances': 'bank-data-poller',
  'poll_accounts': 'bank-data-poller',
  'poll_reconcile': 'bank-data-poller',
  'reconcile': 'bank-reconcile-engine',
  'router_failover': 'bank-data-router',
};

async function invokeFunction(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `${res.status}: ${txt.slice(0, 200)}` };
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

  const admin = createClient(supabaseUrl, serviceKey);
  const summary = { picked: 0, replayed: 0, dead_lettered: 0, rescheduled: 0 };

  const { data: rows, error } = await admin
    .from('bank_retry_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) return json({ error: error.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: true, summary, message: 'no due retries' });

  summary.picked = rows.length;

  for (const row of rows) {
    // Mark processing
    await admin.from('bank_retry_queue').update({
      status: 'processing',
      last_attempt_at: new Date().toISOString(),
      attempt_count: row.attempt_count + 1,
    }).eq('id', row.id);

    const fnName = OPERATION_TO_FUNCTION[row.operation];
    let result: { ok: boolean; error?: string };
    if (!fnName) {
      result = { ok: false, error: `Unknown operation: ${row.operation}` };
    } else {
      result = await invokeFunction(fnName, (row.payload ?? {}) as Record<string, unknown>);
    }

    if (result.ok) {
      await admin.from('bank_retry_queue').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_error: null,
      }).eq('id', row.id);

      await admin.from('bank_connector_attempts').insert({
        bank_id: row.bank_id,
        config_id: row.config_id,
        operation: `retry_${row.operation}`,
        status: 'success',
        latency_ms: 0,
        response_meta: { retry_id: row.id, attempt: row.attempt_count + 1 },
      });
      summary.replayed++;
    } else if (row.attempt_count + 1 >= row.max_attempts) {
      await admin.from('bank_retry_queue').update({
        status: 'dead_letter',
        dead_lettered_at: new Date().toISOString(),
        last_error: result.error?.slice(0, 500),
      }).eq('id', row.id);

      await admin.from('bank_connector_attempts').insert({
        bank_id: row.bank_id,
        config_id: row.config_id,
        operation: `retry_${row.operation}`,
        status: 'failed',
        latency_ms: 0,
        error_message: `DEAD LETTER: ${result.error}`,
      });
      summary.dead_lettered++;
    } else {
      const backoff = computeBackoff(row.attempt_count + 1);
      await admin.from('bank_retry_queue').update({
        status: 'pending',
        next_attempt_at: new Date(Date.now() + backoff * 1000).toISOString(),
        last_error: result.error?.slice(0, 500),
      }).eq('id', row.id);
      summary.rescheduled++;
    }
  }

  return json({ ok: true, summary });
});
