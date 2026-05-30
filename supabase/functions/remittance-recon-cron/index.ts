/**
 * Remittance Reconciliation Automation Cron
 * 
 * Runs periodically (invoked by scheduled job or manually) to:
 * 1. Flag stale remittances (received/credited but not settled after X hours)
 * 2. Auto-match settled remittances against partner settlement statements
 * 3. Generate reconciliation run reports
 *
 * Actions: run_recon, flag_stale, list_runs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { recordRemittanceAudit } from "../_shared/remittance-audit.ts";

const STALE_HOURS_THRESHOLD = 48; // Flag after 48 hours without settlement

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    let body: Record<string, any> = {};

    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
      action = action || body.action;
    }

    // P0 AUTH GATE — require service-role/cron secret OR an authenticated admin.
    // Previously the function was publicly executable (token-less requests passed).
    const cronAuth = verifyCronAuth(req);
    if (!cronAuth.authorized) {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) return json({ error: 'unauthorized' }, 401);
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !user) return json({ error: 'unauthorized' }, 401);
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return json({ error: 'forbidden' }, 403);
    }

    switch (action || 'run_recon') {
      case 'run_recon': {
        const partnerId = body.partner_id;
        const periodStart = body.period_start || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const periodEnd = body.period_end || new Date().toISOString().split('T')[0];

        // Create run record
        const { data: run } = await supabase.from('remittance_recon_runs').insert({
          partner_id: partnerId || null,
          run_type: body.run_type || 'automated',
          period_start: periodStart,
          period_end: periodEnd,
          status: 'running',
        }).select().single();

        if (!run) return json({ error: 'failed_to_create_run' }, 500);

        let totalChecked = 0, matched = 0, mismatched = 0, staleFlagged = 0;

        // 1. Cross-reference remittances against reconciliation items
        let remQuery = supabase
          .from('remittances')
          .select('id, partner_id, partner_reference, amount_out, status, credited_at, settled_at')
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd + 'T23:59:59Z')
          .in('status', ['credited', 'settled']);

        if (partnerId) remQuery = remQuery.eq('partner_id', partnerId);

        const { data: remittances } = await remQuery;

        for (const rem of remittances || []) {
          totalChecked++;

          // Check if there's a matching reconciliation item
          const { data: reconItem } = await supabase
            .from('remittance_reconciliation_items')
            .select('id, status, expected_amount, actual_amount')
            .eq('remittance_id', rem.id)
            .maybeSingle();

          if (reconItem) {
            if (reconItem.status === 'resolved') {
              matched++;
            } else {
              mismatched++;
            }
          } else {
            // No recon item = not yet in any settlement statement = check if stale
            const creditedAt = rem.credited_at ? new Date(rem.credited_at).getTime() : 0;
            const hoursSinceCredited = (Date.now() - creditedAt) / 3600000;

            if (hoursSinceCredited > STALE_HOURS_THRESHOLD && rem.status !== 'settled') {
              staleFlagged++;

              // Record a stale event
              await supabase.from('remittance_events').insert({
                remittance_id: rem.id,
                event_type: 'credited', // Keep same status
                payload_raw: {
                  alert: 'stale_unsettled',
                  hours_since_credit: Math.round(hoursSinceCredited),
                  flagged_by: 'recon_cron',
                },
                actor_type: 'system',
              });
            } else {
              matched++; // Within acceptable window
            }
          }
        }

        // 2. Update run record
        await supabase.from('remittance_recon_runs').update({
          total_checked: totalChecked,
          matched,
          mismatched,
          stale_flagged: staleFlagged,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }).eq('id', run.id);

        // 3. If mismatches or stale items, notify admin
        if (mismatched > 0 || staleFlagged > 0) {
          await supabase.from('app_notifications').insert({
            user_id: '00000000-0000-0000-0000-000000000000', // Will be caught by admin notification handler
            type: 'warning',
            title: 'Remittance Reconciliation Alert',
            message: `Recon run completed: ${mismatched} mismatches, ${staleFlagged} stale items out of ${totalChecked} checked.`,
            icon: 'reconciliation',
            metadata: { run_id: run.id, mismatched, stale_flagged: staleFlagged },
          });
        }

        return json({
          run_id: run.id,
          total_checked: totalChecked,
          matched,
          mismatched,
          stale_flagged: staleFlagged,
          status: 'completed',
        });
      }

      case 'flag_stale': {
        const thresholdHours = body.threshold_hours || STALE_HOURS_THRESHOLD;
        const cutoff = new Date(Date.now() - thresholdHours * 3600000).toISOString();

        const { data: stale } = await supabase
          .from('remittances')
          .select('id, partner_reference, receiver_name, amount_out, credited_at, destination_type, remittance_partners(name)')
          .eq('status', 'credited')
          .lt('credited_at', cutoff)
          .order('credited_at', { ascending: true });

        return json({ stale_remittances: stale, total: stale?.length || 0, threshold_hours: thresholdHours });
      }

      case 'list_runs': {
        const { data, error } = await supabase
          .from('remittance_recon_runs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        return json({ runs: data });
      }

      default:
        return json({ error: 'unknown_action', action }, 400);
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'remittance-recon-cron');
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
