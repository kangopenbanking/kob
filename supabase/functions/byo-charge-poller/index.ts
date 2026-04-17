// BYO Charge Poller — reconciles pending MTN/Orange/SOAP charges that providers
// don't reliably push. Runs on cron, picks due rows from byo_charge_polls,
// calls connector.getStatus(), and on terminal status fires synthetic webhooks
// via the existing webhook-dispatcher and records platform fee.
//
// Backoff schedule (seconds): 30, 60, 120, 300, 600, 1800 (cap), max 20 attempts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decryptCredentials, getConnector } from '../_shared/payment-connectors/registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BACKOFF_SECONDS = [30, 60, 120, 300, 600, 1800];
const BATCH_SIZE = 25;

function nextPollAt(attempt: number): string {
  const idx = Math.min(attempt, BACKOFF_SECONDS.length - 1);
  return new Date(Date.now() + BACKOFF_SECONDS[idx] * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Pick due pending rows
    const { data: due, error } = await admin
      .from('byo_charge_polls')
      .select('id, charge_id, tenant_connector_id, connector_id, provider_reference, owner_type, owner_id, attempt_count, max_attempts, metadata')
      .eq('status', 'pending')
      .lte('next_poll_at', new Date().toISOString())
      .order('next_poll_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;

    const results: Array<{ id: string; outcome: string }> = [];

    for (const row of (due ?? [])) {
      try {
        // Load connector credentials
        const { data: conn, error: cErr } = await admin
          .from('tenant_payment_connectors')
          .select('credentials_encrypted, environment, country, connector_id')
          .eq('id', row.tenant_connector_id)
          .single();
        if (cErr || !conn) {
          await admin.from('byo_charge_polls').update({
            status: 'failed', last_error: 'connector_missing', terminal_at: new Date().toISOString(),
          }).eq('id', row.id);
          results.push({ id: row.id, outcome: 'connector_missing' });
          continue;
        }

        const credentials = await decryptCredentials(conn.credentials_encrypted as Record<string, unknown>);
        const connector = getConnector(conn.connector_id);
        const statusRes = await connector.getStatus(
          { credentials, environment: conn.environment, country: conn.country },
          row.provider_reference,
        );

        const newAttempt = row.attempt_count + 1;

        if (statusRes.status === 'successful' || statusRes.status === 'failed') {
          // Terminal — close out
          await admin.from('byo_charge_polls').update({
            status: statusRes.status,
            attempt_count: newAttempt,
            last_polled_at: new Date().toISOString(),
            terminal_at: new Date().toISOString(),
          }).eq('id', row.id);

          // Update gateway_charges if linked
          if (row.charge_id) {
            await admin.from('gateway_charges').update({
              status: statusRes.status,
              updated_at: new Date().toISOString(),
            }).eq('id', row.charge_id);
          }

          // Synthetic webhook via existing dispatcher
          try {
            await admin.functions.invoke('webhook-dispatcher', {
              body: {
                event_type: statusRes.status === 'successful' ? 'charge.completed' : 'charge.failed',
                event_data: {
                  charge_id: row.charge_id,
                  provider_reference: row.provider_reference,
                  connector_id: row.connector_id,
                  status: statusRes.status,
                  source: 'byo_poller_synthetic',
                },
              },
            });
          } catch (whErr) {
            console.warn('[byo-charge-poller] webhook dispatch failed', whErr);
          }

          // Record fee for institutions only (consistent with router)
          if (statusRes.status === 'successful' && row.owner_type === 'institution') {
            try {
              await admin.rpc('record_transaction_fee', {
                _institution_id: row.owner_id,
                _transaction_type: 'byo_mobile_money_routing',
                _transaction_ref: row.provider_reference,
                _transaction_amount: Number((row.metadata as Record<string, unknown>)?.amount ?? 0),
                _metadata: { connector_used: row.connector_id, source: 'poller' },
              });
            } catch (feeErr) {
              console.warn('[byo-charge-poller] fee record skipped', feeErr);
            }
          }

          results.push({ id: row.id, outcome: statusRes.status });
        } else if (newAttempt >= row.max_attempts) {
          // Exhausted
          await admin.from('byo_charge_polls').update({
            status: 'expired', attempt_count: newAttempt,
            last_polled_at: new Date().toISOString(),
            terminal_at: new Date().toISOString(),
            last_error: 'max_attempts_reached',
          }).eq('id', row.id);
          results.push({ id: row.id, outcome: 'expired' });
        } else {
          // Schedule next poll
          await admin.from('byo_charge_polls').update({
            attempt_count: newAttempt,
            last_polled_at: new Date().toISOString(),
            next_poll_at: nextPollAt(newAttempt),
          }).eq('id', row.id);
          results.push({ id: row.id, outcome: 'pending' });
        }
      } catch (e) {
        await admin.from('byo_charge_polls').update({
          attempt_count: row.attempt_count + 1,
          last_polled_at: new Date().toISOString(),
          next_poll_at: nextPollAt(row.attempt_count + 1),
          last_error: e instanceof Error ? e.message : String(e),
        }).eq('id', row.id);
        results.push({ id: row.id, outcome: 'error' });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[byo-charge-poller]', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
