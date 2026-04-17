// Wave 5A — bank-data-poller (operationalized) — redeploy 2026-04-17 phase3b
// Cron-driven scheduler that pulls accounts/balances/transactions for every
// enabled bank_sync_jobs row whose next_run_at <= now().
//
// Wave 5 changes:
//  - Adds `accounts` op_type support
//  - Persists transactions into `bank_side_transactions` (idempotent upsert)
//  - Persists balances into `bank_side_balances`
//  - On failure, enqueues into `bank_retry_queue` for the retry-worker

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getBankConnector } from '../_shared/bank-connectors/registry.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { enqueueRetry } from '../_shared/bank-connectors/retry-helper.ts';
import type { BankConnectorContext, DateRange } from '../_shared/bank-connectors/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BACKOFF_SECONDS = 3600;
const BASE_BACKOFF_SECONDS = 60;
const BATCH_LIMIT = 25;
const RETRY_AFTER_FAILURES = 3; // enqueue into retry queue after N consecutive failures

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

  console.log('[bank-data-poller] request received', {
    method: req.method,
    has_cron_secret: !!req.headers.get('x-cron-secret'),
    has_auth: !!req.headers.get('authorization'),
    cron_secret_env_set: !!Deno.env.get('CRON_SECRET'),
  });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) {
    console.log('[bank-data-poller] AUTH REJECTED');
    return auth.response!;
  }
  console.log('[bank-data-poller] auth ok, proceeding');

  const admin = createClient(supabaseUrl, serviceKey);
  const startedAt = Date.now();
  const summary = { picked: 0, ok: 0, failed: 0, skipped: 0, retries_enqueued: 0 };

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
        case 'accounts': {
          if (!job.external_account_id) throw new Error('external_account_id required for accounts op');
          const acc = await connector.getAccountDetails(ctx, job.external_account_id);
          recordCount = 1;
          newWatermark = new Date().toISOString();
          // Audit-only persist; account master is admin-onboarded, not poller-managed
          await admin.from('bank_connector_attempts').insert({
            config_id: cfg.id,
            bank_id: job.bank_id,
            operation: 'poll_accounts',
            status: 'success',
            latency_ms: 0,
            response_meta: { external_account_id: acc.external_account_id, currency: acc.currency },
          });
          break;
        }
        case 'transactions': {
          if (!job.external_account_id) throw new Error('external_account_id required for transactions op');
          const txs = await connector.getTransactions(ctx, job.external_account_id, range);
          recordCount = txs.length;

          if (txs.length > 0) {
            // Idempotent upsert into bank-side staging
            const rows = txs.map((t) => ({
              bank_id: job.bank_id,
              config_id: cfg.id,
              external_account_id: t.account_id,
              external_tx_id: t.external_tx_id,
              booking_date: t.booking_date || null,
              value_date: t.value_date || null,
              amount: t.amount,
              currency: t.currency,
              credit_debit: t.credit_debit,
              reference: t.reference ?? null,
              description: t.description ?? null,
              raw: t.raw ?? null,
            }));
            const { error: upErr } = await admin
              .from('bank_side_transactions')
              .upsert(rows, { onConflict: 'bank_id,external_account_id,external_tx_id', ignoreDuplicates: true });
            if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);

            newWatermark = txs.reduce(
              (max, t) => (t.booking_date > max ? t.booking_date : max),
              range.from,
            );
          } else {
            newWatermark = range.to;
          }
          break;
        }
        case 'balances': {
          if (!job.external_account_id) throw new Error('external_account_id required for balances op');
          const bal = await connector.getBalance(ctx, job.external_account_id);
          recordCount = 1;
          await admin.from('bank_side_balances').insert({
            bank_id: job.bank_id,
            config_id: cfg.id,
            external_account_id: bal.account_id,
            amount: bal.amount,
            currency: bal.currency,
            balance_type: bal.balance_type,
            as_of_datetime: bal.as_of_datetime,
            raw: bal.raw ?? null,
          });
          newWatermark = bal.as_of_datetime;
          break;
        }
        case 'reconcile': {
          const r = await connector.reconcile(ctx, range);
          recordCount = r.total_compared;
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
            flagged_for_review: r.missing_in_bank + r.amount_mismatches + r.missing_in_kob,
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

      // After N failures, also enqueue into the persistent retry queue
      if (failures >= RETRY_AFTER_FAILURES) {
        const r = await enqueueRetry(admin, {
          bank_id: job.bank_id,
          config_id: cfg.id,
          operation: `poll_${job.op_type}`,
          payload: { sync_job_id: job.id, op_type: job.op_type },
          error_message: msg,
        });
        if (r.id) summary.retries_enqueued++;
      }

      summary.failed++;
    }
  }

  return json({ ok: true, summary, elapsed_ms: Date.now() - startedAt });
});
