/**
 * Remittance Settlement & Reconciliation Engine
 *
 * Actions:
 *   list_settlements, get_settlement, import_statement,
 *   resolve_mismatch, close_settlement, partner_health
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    let body: Record<string, any> = {};

    if (req.method === 'POST' || req.method === 'PATCH') {
      body = await req.json().catch(() => ({}));
      action = action || body.action;
    }

    // Auth: admin only
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    switch (action) {
      case 'list_settlements': {
        const status = url.searchParams.get('status') || body.status;
        const partnerId = url.searchParams.get('partner_id') || body.partner_id;

        let query = supabase
          .from('remittance_settlements')
          .select('*, remittance_partners(name, display_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(50);

        if (status) query = query.eq('status', status);
        if (partnerId) query = query.eq('partner_id', partnerId);

        const { data, error, count } = await query;
        if (error) throw error;
        return json({ settlements: data, total: count });
      }

      case 'get_settlement': {
        const id = url.searchParams.get('id') || body.id;
        const [settRes, itemsRes] = await Promise.all([
          supabase.from('remittance_settlements').select('*, remittance_partners(name, display_name)').eq('id', id).single(),
          supabase.from('remittance_reconciliation_items').select('*').eq('settlement_id', id).order('created_at'),
        ]);
        return json({ settlement: settRes.data, items: itemsRes.data });
      }

      case 'import_statement': {
        const { partner_id, period_start, period_end, items: statementItems, currency } = body;
        if (!partner_id || !period_start || !period_end || !statementItems?.length) {
          return json({ error: 'missing_required_fields' }, 400);
        }

        // Calculate totals
        let grossIn = 0;
        let totalFees = 0;
        statementItems.forEach((item: any) => {
          grossIn += item.amount || 0;
          totalFees += item.fee || 0;
        });

        // Create settlement
        const { data: settlement, error: sErr } = await supabase
          .from('remittance_settlements')
          .insert({
            partner_id, period_start, period_end,
            currency: currency || 'XAF',
            gross_in: grossIn, fees: totalFees,
            net_settlement: grossIn - totalFees,
            remittance_count: statementItems.length,
            status: 'open',
            statement_raw: body,
          })
          .select().single();

        if (sErr) throw sErr;

        // Create reconciliation items — match against platform records
        const reconItems = [];
        for (const item of statementItems) {
          const { data: platformRem } = await supabase
            .from('remittances')
            .select('id, amount_out, status')
            .eq('partner_id', partner_id)
            .eq('partner_reference', item.partner_reference)
            .maybeSingle();

          let mismatchReason: string | null = null;

          if (!platformRem) {
            mismatchReason = 'missing_in_platform';
          } else if (Math.abs((platformRem.amount_out || 0) - (item.amount || 0)) > 1) {
            mismatchReason = 'amount';
          } else if (item.fee && Math.abs((item.fee || 0) - (item.expected_fee || 0)) > 0.5) {
            mismatchReason = 'fee';
          }

          reconItems.push({
            settlement_id: settlement.id,
            remittance_id: platformRem?.id || null,
            partner_reference: item.partner_reference,
            expected_amount: item.amount,
            actual_amount: platformRem?.amount_out || null,
            mismatch_reason: mismatchReason,
            status: mismatchReason ? 'open' : 'resolved',
          });
        }

        // Check for missing in provider (platform has records partner didn't list)
        const partnerRefs = statementItems.map((i: any) => i.partner_reference);
        const { data: missingInProvider } = await supabase
          .from('remittances')
          .select('id, partner_reference, amount_out')
          .eq('partner_id', partner_id)
          .gte('created_at', period_start)
          .lte('created_at', period_end + 'T23:59:59Z')
          .not('partner_reference', 'in', `(${partnerRefs.map((r: string) => `"${r}"`).join(',')})`);

        if (missingInProvider?.length) {
          for (const m of missingInProvider) {
            reconItems.push({
              settlement_id: settlement.id,
              remittance_id: m.id,
              partner_reference: m.partner_reference,
              expected_amount: m.amount_out,
              actual_amount: null,
              mismatch_reason: 'missing_in_provider',
              status: 'open',
            });
          }
        }

        await supabase.from('remittance_reconciliation_items').insert(reconItems);

        const mismatches = reconItems.filter(i => i.mismatch_reason);
        if (mismatches.length > 0) {
          await supabase.from('remittance_settlements').update({ status: 'mismatch' }).eq('id', settlement.id);
        } else {
          await supabase.from('remittance_settlements').update({ status: 'reconciled' }).eq('id', settlement.id);
        }

        return json({
          settlement_id: settlement.id,
          total_items: reconItems.length,
          mismatches: mismatches.length,
          status: mismatches.length > 0 ? 'mismatch' : 'reconciled',
        });
      }

      case 'resolve_mismatch': {
        const { item_id, resolution_note } = body;
        if (!item_id) return json({ error: 'missing_item_id' }, 400);

        await supabase.from('remittance_reconciliation_items').update({
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_note: resolution_note || 'Resolved by admin',
        }).eq('id', item_id);

        // Check if all items resolved → close settlement
        const { data: item } = await supabase
          .from('remittance_reconciliation_items')
          .select('settlement_id')
          .eq('id', item_id)
          .single();

        if (item) {
          const { data: remaining } = await supabase
            .from('remittance_reconciliation_items')
            .select('id')
            .eq('settlement_id', item.settlement_id)
            .eq('status', 'open');

          if (!remaining?.length) {
            await supabase.from('remittance_settlements').update({
              status: 'reconciled', updated_at: new Date().toISOString(),
            }).eq('id', item.settlement_id);
          }
        }

        return json({ resolved: true });
      }

      case 'close_settlement': {
        const { settlement_id } = body;
        await supabase.from('remittance_settlements').update({
          status: 'closed', updated_at: new Date().toISOString(),
        }).eq('id', settlement_id);
        return json({ closed: true });
      }

      case 'partner_health': {
        const { data: partners } = await supabase
          .from('remittance_partners')
          .select('id, name, display_name, status');

        const healthData = [];
        for (const p of partners || []) {
          // Recent webhook events
          const { data: recentEvents, count } = await supabase
            .from('remittance_events')
            .select('id, event_type, signature_valid, created_at', { count: 'exact' })
            .eq('payload_raw->>partner', p.name)
            .order('created_at', { ascending: false })
            .limit(10);

          const sigFailures = recentEvents?.filter((e: any) => !e.signature_valid).length || 0;
          const lastEvent = recentEvents?.[0]?.created_at;

          healthData.push({
            partner_id: p.id,
            name: p.name,
            display_name: p.display_name,
            status: p.status,
            total_events: count || 0,
            recent_sig_failures: sigFailures,
            last_event_at: lastEvent,
          });
        }

        return json({ partners: healthData });
      }

      default:
        return json({ error: 'unknown_action', action }, 400);
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'remittance-settlement');
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
