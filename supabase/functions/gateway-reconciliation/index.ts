import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Admin check
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    const url = new URL(req.url);
    const method = req.method;
    const runId = url.searchParams.get('run_id');
    const mismatchId = url.searchParams.get('mismatch_id');
    const action = url.searchParams.get('action'); // resolve

    // POST - Create reconciliation run
    if (method === 'POST' && !action) {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const body = await req.json();
      const { merchant_id, provider, period_start, period_end } = body;
      if (!period_start || !period_end) return new Response(JSON.stringify({ error: 'period_start and period_end required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Create run
      const { data: run, error: runErr } = await supabase.from('gateway_reconciliation_runs').insert({
        merchant_id: merchant_id || null, provider: provider || null,
        period_start, period_end, status: 'running', started_at: new Date().toISOString(),
        initiated_by: user.id,
      }).select().single();
      if (runErr) throw runErr;

      // Perform reconciliation: compare internal records with provider webhook inbox
      let chargeQuery = supabase.from('gateway_charges').select('id, amount, status, provider, provider_ref, tx_ref, created_at')
        .gte('created_at', period_start).lte('created_at', period_end);
      if (merchant_id) chargeQuery = chargeQuery.eq('merchant_id', merchant_id);
      if (provider) chargeQuery = chargeQuery.eq('provider', provider);
      const { data: charges } = await chargeQuery;

      let payoutQuery = supabase.from('gateway_payouts').select('id, amount, status, provider, provider_ref, tx_ref, created_at')
        .gte('created_at', period_start).lte('created_at', period_end);
      if (merchant_id) payoutQuery = payoutQuery.eq('merchant_id', merchant_id);
      if (provider) payoutQuery = payoutQuery.eq('provider', provider);
      const { data: payouts } = await payoutQuery;

      // Get webhook inbox events for the period
      const { data: webhookEvents } = await supabase.from('webhook_inbox').select('*')
        .gte('created_at', period_start).lte('created_at', period_end);

      const totalInternal = (charges?.length || 0) + (payouts?.length || 0);
      const totalProvider = webhookEvents?.length || 0;
      let matched = 0;
      let mismatched = 0;
      const mismatches: Array<Record<string, unknown>> = [];

      // Check charges stuck in pending/processing
      for (const charge of charges || []) {
        if (['pending', 'processing'].includes(charge.status)) {
          // Check if there's a webhook event for this charge
          const hasEvent = webhookEvents?.some(e => {
            const payload = e.payload as Record<string, unknown>;
            const data = payload?.data as Record<string, unknown>;
            return data?.tx_ref === charge.tx_ref || data?.flw_ref === charge.provider_ref;
          });
          if (hasEvent) {
            mismatches.push({
              run_id: run.id, object_type: 'charge', object_id: charge.id,
              mismatch_type: 'status_mismatch',
              internal_value: charge.status, provider_value: 'webhook_received_but_not_processed',
            });
            mismatched++;
          } else {
            matched++; // Genuinely pending
          }
        } else {
          matched++;
        }
      }

      // Check payouts stuck
      for (const payout of payouts || []) {
        if (['pending', 'processing'].includes(payout.status) && payout.provider_ref) {
          mismatches.push({
            run_id: run.id, object_type: 'payout', object_id: payout.id,
            mismatch_type: 'status_mismatch',
            internal_value: payout.status, provider_value: 'stuck_in_processing',
          });
          mismatched++;
        } else {
          matched++;
        }
      }

      // Insert mismatches
      if (mismatches.length > 0) {
        await supabase.from('gateway_reconciliation_mismatches').insert(mismatches);
      }

      // Update run
      await supabase.from('gateway_reconciliation_runs').update({
        status: 'completed', finished_at: new Date().toISOString(),
        total_internal: totalInternal, total_provider: totalProvider,
        matched, mismatched,
        summary: { charges_checked: charges?.length || 0, payouts_checked: payouts?.length || 0, webhook_events: totalProvider },
      }).eq('id', run.id);

      const { data: finalRun } = await supabase.from('gateway_reconciliation_runs').select('*').eq('id', run.id).single();

      return new Response(JSON.stringify({ data: finalRun }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST - Resolve mismatch
    if (method === 'POST' && action === 'resolve' && mismatchId) {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const body = await req.json();
      const { resolution_notes } = body;

      const { data, error } = await supabase.from('gateway_reconciliation_mismatches').update({
        status: 'resolved', resolution_notes, resolved_by: user.id, resolved_at: new Date().toISOString(),
      }).eq('id', mismatchId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET - List runs or get run details or get mismatches
    if (method === 'GET') {
      if (runId && action === 'mismatches') {
        const { data, error } = await supabase.from('gateway_reconciliation_mismatches')
          .select('*').eq('run_id', runId).order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (runId) {
        const { data, error } = await supabase.from('gateway_reconciliation_runs').select('*').eq('id', runId).single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // List runs
      const limit = parseInt(url.searchParams.get('limit') || '25');
      const { data, error } = await supabase.from('gateway_reconciliation_runs')
        .select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
