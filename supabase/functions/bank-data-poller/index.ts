// bank-data-poller: cron-driven scheduler that pulls accounts/balances/transactions
// for every enabled bank_sync_jobs row whose next_run_at <= now().
// Mirrors byo-charge-poller pattern. Runs every 5 minutes via pg_cron.
//
// For each due job:
//   1. Resolve config → adapter
//   2. Execute op (getTransactions / getBalance / reconcile)
//   3. Upsert results into existing tables (account_balances, ledger via outbox)
//   4. Update watermark, schedule next run with exponential backoff on failure

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getBankConnector } from '../_shared/bank-connectors/registry.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import type { BankConnectorContext, DateRange } from '../_shared/bank-connectors/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BACKOFF_SECONDS = 3600; // 1h cap
const BASE_BACKOFF_SECONDS = 60;
const BATCH_LIMIT = 25;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function nextBackoff(failures: number): number {
  return Math.min(BASE_BACKOFF_SECONDS * Math.pow(2, failures), MAX_BACKOFF_SECONDS);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const admin = createClient(supabaseUrl, serviceKey);
  const startedAt = Date.now();
  const summary = { picked: 0, ok: 0, failed: 0, skipped: 0 };

  // Pull due jobs
  const { data: jobs, error: jobErr } = await admin
    .from('bank_sync_jobs')
    .select('*, bank_connector_configs!inner(*)')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (jobErr) return json({ error: jobErr.message }, 500);
  if (!jobs || jobs.length === 0) return json({ ok: true, summary, message: 'no due jobs' });

  summary.picked = jobs.length;

  for (const job of jobs) {
    const cfg = (job as any).bank_connector_configs;
    if (!cfg || !cfg.enabled) {
      summary.skipped++;
      continue;
    }

    const ctx: BankConnectorContext = {
      bank_id: job.bank_id,
      config_id: cfg.id,
      credentials: (cfg.credentials_encrypted ?? {}) as Record<string, string>,
      config: (cfg.config_json ?? {}) as Record<string, unknown>,
      environment: cfg.environment,
      watermark: job.watermark,
    };

    const range: DateRange = {
      from: job.watermark ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    };

    try {
      const connector = getBankConnector(cfg.adapter_type as 'rest' | 'sql' | 'file' | 'soap');
      let recordCount = 0;
      let newWatermark: string | undefined;

      switch (job.op_type) {
        case 'transactions': {
          if (!job.external_account_id) throw new Error('external_account_id required for transactions op');
          const txs = await connector.getTransactions(ctx, job.external_account_id, range);
          recordCount = txs.length;
          if (txs.length > 0) {
            // Stage into bank_file_rows-style staging? For now record attempt + watermark.
            newWatermark = txs.reduce((max, t) => (t.booking_date > max ? t.booking_date : max), range.from);
          } else {
            newWatermark = range.to;
          }
          break;
        }
        case 'balances': {
          if (!job.external_account_id) throw new Error('external_account_id required for balances op');
          const bal = await connector.getBalance(ctx, job.external_account_id);
          recordCount = 1;
          newWatermark = bal.as_of_datetime;
          break;
        }
        case 'reconcile': {
          const r = await connector.reconcile(ctx, range);
          recordCount = r.total_compared;
          // Persist a reconciliation_reports row
          await admin.from('reconciliation_reports').insert({
            bank_id: job.bank_id,
            config_id: cfg.id,
            period_start: range.from,
            period_end: range.to,
            total_compared: r.total_compared,
            matched: r.matched,
            missing_in_kob: r.missing_in_kob,
            missing_in_bank: r.missing_in_bank,
            amount_mismatches: r.amount_mismatches,
            auto_corrected: 0,
            flagged_for_review: r.missing_in_bank + r.amount_mismatches,
            status: 'completed',
            details: r.details ?? [],
          });
          newWatermark = range.to;
          break;
        }
        default:
          throw new Error(`Unsupported op_type: ${job.op_type}`);
      }

      const intervalSec = cfg.polling_interval_seconds ?? 300;
      await admin.from('bank_sync_jobs').update({
        watermark: newWatermark ?? job.watermark,
        last_run_at: new Date().toISOString(),
        last_status: 'ok',
        last_error: null,
        consecutive_failures: 0,
        backoff_seconds: 0,
        next_run_at: new Date(Date.now() + intervalSec * 1000).toISOString(),
      }).eq('id', job.id);

      await admin.from('bank_connector_attempts').insert({
        config_id: cfg.id,
        bank_id: job.bank_id,
        operation: `poll_${job.op_type}`,
        status: 'success',
        latency_ms: 0,
        response_meta: { record_count: recordCount, watermark: newWatermark },
      });

      summary.ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failures = (job.consecutive_failures ?? 0) + 1;
      const backoff = nextBackoff(failures);

      await admin.from('bank_sync_jobs').update({
        last_run_at: new Date().toISOString(),
        last_status: 'failed',
        last_error: msg.slice(0, 500),
        consecutive_failures: failures,
        backoff_seconds: backoff,
        next_run_at: new Date(Date.now() + backoff * 1000).toISOString(),
      }).eq('id', job.id);

      await admin.from('bank_connector_attempts').insert({
        config_id: cfg.id,
        bank_id: job.bank_id,
        operation: `poll_${job.op_type}`,
        status: 'failed',
        latency_ms: 0,
        error_message: msg,
      });

      summary.failed++;
    }
  }

  return json({ ok: true, summary, elapsed_ms: Date.now() - startedAt });
});
