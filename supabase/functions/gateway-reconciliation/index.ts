import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `${Deno.env.get("SUPABASE_URL")!}/functions/v1/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    // Admin only
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Admin access required');

    const url = new URL(req.url);

    // ─── GET — List runs or get specific run with mismatches ───
    if (req.method === 'GET') {
      const runId = url.searchParams.get('run_id');

      if (runId) {
        const { data: run } = await supabase
          .from('reconciliation_runs').select('*').eq('id', runId).single();
        if (!run) return rfc7807('not_found', 'Not Found', 404, 'Run not found');

        const { data: mismatches } = await supabase
          .from('reconciliation_mismatches').select('*')
          .eq('run_id', runId).order('created_at', { ascending: false });

        return json({ ...run, mismatches: mismatches || [] });
      }

      // List runs
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      const status = url.searchParams.get('status');
      const runType = url.searchParams.get('run_type');

      let query = supabase.from('reconciliation_runs').select('*', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (runType) query = query.eq('run_type', runType);

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) return rfc7807('query_error', 'Query Error', 500, error.message);

      const { count: openCount } = await supabase
        .from('reconciliation_mismatches').select('id', { count: 'exact' })
        .eq('resolution_status', 'open');

      return json({
        runs: data, total: count, page, limit,
        stats: { open_mismatches: openCount || 0 },
      });
    }

    if (req.method !== 'POST') return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only GET and POST');

    const body = await req.json();
    const { action } = body;

    // ─── RUN — Start a new reconciliation run ───
    if (action === 'run') {
      const { run_type, provider, period_start, period_end } = body;

      if (!run_type) return rfc7807('validation_error', 'Validation Error', 400, 'run_type required');
      if (!period_start || !period_end) {
        return rfc7807('validation_error', 'Validation Error', 400, 'period_start and period_end required');
      }

      const { data: run, error: createErr } = await supabase.from('reconciliation_runs').insert({
        run_type, provider, period_start, period_end,
        status: 'running', started_at: new Date().toISOString(), initiated_by: user.id,
      }).select().single();

      if (createErr) return rfc7807('create_failed', 'Create Failed', 500, createErr.message);

      try {
        let platformRecords: any[] = [];
        const mismatches: any[] = [];
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // ── Charges ──
        if (run_type === 'charges' || run_type === 'full') {
          const { data: charges } = await supabase
            .from('gateway_charges').select('id, status, amount, currency, provider_ref, provider, created_at')
            .gte('created_at', period_start).lte('created_at', period_end);

          const chargeRecords = charges || [];
          platformRecords = [...platformRecords, ...chargeRecords];

          for (const c of chargeRecords) {
            if (c.status === 'pending' && c.created_at < twoHoursAgo) {
              mismatches.push({
                run_id: run.id, mismatch_type: 'status_mismatch', entity_type: 'charge',
                entity_id: c.id, provider_ref: c.provider_ref, platform_status: c.status,
                provider_status: 'unknown', platform_amount: c.amount, platform_currency: c.currency,
                details: { reason: 'Charge stuck in pending >2h', provider: c.provider },
              });
            }
          }
        }

        // ── Payouts ──
        if (run_type === 'payouts' || run_type === 'full') {
          const { data: payouts } = await supabase
            .from('gateway_payouts').select('id, status, amount, currency, provider_ref, provider, created_at')
            .gte('created_at', period_start).lte('created_at', period_end);

          const payoutRecords = payouts || [];
          platformRecords = [...platformRecords, ...payoutRecords];

          for (const p of payoutRecords) {
            if (['pending', 'processing'].includes(p.status) && p.created_at < oneHourAgo) {
              mismatches.push({
                run_id: run.id, mismatch_type: 'status_mismatch', entity_type: 'payout',
                entity_id: p.id, provider_ref: p.provider_ref, platform_status: p.status,
                provider_status: 'unknown', platform_amount: p.amount, platform_currency: p.currency,
                details: { reason: 'Payout stuck in pending/processing >1h', provider: p.provider },
              });
            }
          }
        }

        // ── Refunds ──
        if (run_type === 'refunds' || run_type === 'full') {
          const { data: refunds } = await supabase
            .from('gateway_refunds').select('id, status, amount, currency, created_at')
            .gte('created_at', period_start).lte('created_at', period_end);

          const refundRecords = refunds || [];
          platformRecords = [...platformRecords, ...refundRecords];

          for (const r of refundRecords) {
            if (r.status === 'pending' && r.created_at < twoHoursAgo) {
              mismatches.push({
                run_id: run.id, mismatch_type: 'status_mismatch', entity_type: 'refund',
                entity_id: r.id, platform_status: r.status, provider_status: 'unknown',
                platform_amount: r.amount, platform_currency: r.currency,
                details: { reason: 'Refund stuck in pending >2h' },
              });
            }
          }
        }

        if (mismatches.length > 0) {
          await supabase.from('reconciliation_mismatches').insert(mismatches);
        }

        await supabase.from('reconciliation_runs').update({
          status: 'completed', completed_at: new Date().toISOString(),
          total_platform_records: platformRecords.length,
          matched_count: platformRecords.length - mismatches.length,
          mismatched_count: mismatches.length,
          summary: {
            run_type, period: { start: period_start, end: period_end },
            mismatch_breakdown: mismatches.reduce((acc: any, m: any) => {
              acc[m.mismatch_type] = (acc[m.mismatch_type] || 0) + 1; return acc;
            }, {}),
          },
        }).eq('id', run.id);

        return json({
          run_id: run.id, status: 'completed',
          total_records: platformRecords.length, mismatches_found: mismatches.length,
          completed_at: new Date().toISOString(),
        });

      } catch (runErr: any) {
        await supabase.from('reconciliation_runs').update({
          status: 'failed', completed_at: new Date().toISOString(), error_message: runErr.message,
        }).eq('id', run.id);
        return rfc7807('run_failed', 'Reconciliation Failed', 500, runErr.message);
      }
    }

    // ─── RESOLVE — Resolve a mismatch ───
    if (action === 'resolve') {
      const { mismatch_id, resolution_status, resolution_action, resolution_notes } = body;
      if (!mismatch_id) return rfc7807('validation_error', 'Validation Error', 400, 'mismatch_id required');
      if (!resolution_status) return rfc7807('validation_error', 'Validation Error', 400, 'resolution_status required');

      const { data: mismatch } = await supabase
        .from('reconciliation_mismatches').select('*').eq('id', mismatch_id).single();
      if (!mismatch) return rfc7807('not_found', 'Not Found', 404, 'Mismatch not found');
      if (mismatch.resolution_status === 'resolved') {
        return rfc7807('already_resolved', 'Already Resolved', 409, 'Already resolved');
      }

      await supabase.from('reconciliation_mismatches').update({
        resolution_status, resolution_action: resolution_action || null,
        resolution_notes: resolution_notes || null, resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      }).eq('id', mismatch_id);

      await supabase.from('audit_logs').insert({
        action_type: 'reconciliation_mismatch_resolved', entity_type: 'reconciliation_mismatch',
        entity_id: mismatch_id, performed_by: user.id,
        details: { resolution_status, resolution_action, entity_type: mismatch.entity_type, entity_id: mismatch.entity_id },
      });

      return json({ mismatch_id, resolution_status, resolved_at: new Date().toISOString() });
    }

    // ─── STATS — Dashboard statistics ───
    if (action === 'stats') {
      const { data: recentRuns } = await supabase
        .from('reconciliation_runs').select('*').order('created_at', { ascending: false }).limit(5);

      const { count: openCount } = await supabase
        .from('reconciliation_mismatches').select('id', { count: 'exact' }).eq('resolution_status', 'open');

      const { count: escalatedCount } = await supabase
        .from('reconciliation_mismatches').select('id', { count: 'exact' }).eq('resolution_status', 'escalated');

      const { count: totalRuns } = await supabase
        .from('reconciliation_runs').select('id', { count: 'exact' });

      return json({
        total_runs: totalRuns || 0, open_mismatches: openCount || 0,
        escalated_mismatches: escalatedCount || 0, recent_runs: recentRuns || [],
      });
    }

    return rfc7807('invalid_action', 'Invalid Action', 400, `Unknown action: ${action}`);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-reconciliation] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});
