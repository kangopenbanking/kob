// bank-reconcile-engine: rule-based reconciliation with auto-correction.
// Admin-triggered. For a given bank + date range:
//  1. Fetch bank-side data via configured connector
//  2. Compare against KOB-side records
//  3. Apply rules:
//     - missing_in_kob → flag for review (insert is delegated to ledger team, never auto-credit)
//     - missing_in_bank → flag for review
//     - amount_mismatches → flag for review
//     - duplicates → soft-flag in details
//  4. Persist reconciliation_reports row
//
// SAFETY: No auto-credit. Auto-correction is limited to status flagging, never financial moves.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getBankConnector } from '../_shared/bank-connectors/registry.ts';
import type { BankConnectorContext, DateRange } from '../_shared/bank-connectors/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const RequestSchema = z.object({
  bank_id: z.string().uuid(),
  date_range: z.object({ from: z.string(), to: z.string() }),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Invalid token' }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin role required' }, 403);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { bank_id, date_range } = parsed.data;
  const range: DateRange = date_range;

  // Insert "running" report
  const { data: reportRow, error: insErr } = await admin
    .from('reconciliation_reports')
    .insert({
      bank_id,
      period_start: range.from,
      period_end: range.to,
      status: 'running',
      generated_by: user.id,
    })
    .select('id')
    .single();
  if (insErr || !reportRow) return json({ error: 'Failed to create report', detail: insErr?.message }, 500);

  try {
    // Pick highest-priority enabled adapter
    const { data: configs } = await admin
      .from('bank_connector_configs')
      .select('*')
      .eq('bank_id', bank_id)
      .eq('enabled', true)
      .order('priority', { ascending: true })
      .limit(1);

    if (!configs || configs.length === 0) throw new Error('No enabled adapter for bank');
    const cfg = configs[0];

    const ctx: BankConnectorContext = {
      bank_id,
      config_id: cfg.id,
      credentials: (cfg.credentials_encrypted ?? {}) as Record<string, string>,
      config: (cfg.config_json ?? {}) as Record<string, unknown>,
      environment: cfg.environment,
      watermark: cfg.last_sync_watermark,
    };

    const connector = getBankConnector(cfg.adapter_type as 'rest' | 'sql' | 'file' | 'soap');
    const result = await connector.reconcile(ctx, range);

    // Rule engine: flag-only, never auto-credit
    const flagged = result.missing_in_bank + result.amount_mismatches + result.missing_in_kob;
    const details = (result.details ?? []).map((d) => ({
      ...d,
      rule_applied: 'flag_for_review',
      auto_corrected: false,
    }));

    await admin.from('reconciliation_reports').update({
      total_compared: result.total_compared,
      matched: result.matched,
      missing_in_kob: result.missing_in_kob,
      missing_in_bank: result.missing_in_bank,
      amount_mismatches: result.amount_mismatches,
      auto_corrected: 0,
      flagged_for_review: flagged,
      status: 'completed',
      details,
    }).eq('id', reportRow.id);

    return json({
      success: true,
      report_id: reportRow.id,
      adapter_type: cfg.adapter_type,
      summary: {
        total_compared: result.total_compared,
        matched: result.matched,
        flagged_for_review: flagged,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('reconciliation_reports').update({
      status: 'failed',
      details: [{ error: msg }],
    }).eq('id', reportRow.id);
    return json({ success: false, error: msg, report_id: reportRow.id }, 500);
  }
});
