// Admin endpoint for full settlement system management.
// Actions: list, force_settle (any merchant), set_frequency, pause, resume, stats
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'forbidden', message: 'Admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const action = body.action || (req.method === 'GET' ? 'stats' : null);

  try {
    switch (action) {
      case 'stats': {
        const [{ data: merchants }, { data: wallets }, { data: settlements }] = await Promise.all([
          admin.from('gateway_merchants').select('id, status, settlement_frequency'),
          admin.from('gateway_merchant_wallets').select('currency, pending_balance, available_balance'),
          admin.from('gateway_settlements').select('amount, status, created_at').order('created_at', { ascending: false }).limit(100),
        ]);
        const totalPending = (wallets || []).reduce((s, w) => s + Number(w.pending_balance || 0), 0);
        const totalAvailable = (wallets || []).reduce((s, w) => s + Number(w.available_balance || 0), 0);
        const byFreq = (merchants || []).reduce((acc: Record<string, number>, m: any) => {
          acc[m.settlement_frequency || 'daily'] = (acc[m.settlement_frequency || 'daily'] || 0) + 1;
          return acc;
        }, {});
        return new Response(JSON.stringify({
          merchants_total: merchants?.length || 0,
          merchants_by_frequency: byFreq,
          total_pending: totalPending,
          total_available: totalAvailable,
          recent_settlements: settlements?.slice(0, 20) || [],
          recent_settlements_count: settlements?.length || 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'list_merchants': {
        const { data } = await admin
          .from('gateway_merchants')
          .select('id, business_name, status, settlement_frequency, created_at')
          .order('created_at', { ascending: false })
          .limit(body.limit || 100);
        return new Response(JSON.stringify({ merchants: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'force_settle': {
        // Force settle any merchant by id (admin override).
        const merchantId = body.merchant_id;
        if (!merchantId) {
          return new Response(JSON.stringify({ error: 'merchant_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: wallets } = await admin
          .from('gateway_merchant_wallets')
          .select('id, currency, pending_balance, available_balance')
          .eq('merchant_id', merchantId)
          .gt('pending_balance', 0);

        const settled: any[] = [];
        const now = new Date().toISOString();
        for (const w of wallets || []) {
          const sweep = Number(w.pending_balance);
          const { error } = await admin
            .from('gateway_merchant_wallets')
            .update({
              pending_balance: 0,
              available_balance: Number(w.available_balance) + sweep,
              last_instant_settled_at: now,
              updated_at: now,
            })
            .eq('id', w.id)
            .eq('pending_balance', w.pending_balance);
          if (error) continue;

          const { data: stm } = await admin.from('gateway_settlements').insert({
            merchant_id: merchantId,
            amount: sweep, fees_total: 0, net_amount: sweep,
            currency: w.currency, status: 'settled',
            period_start: now, period_end: now,
            metadata: { cycle: 'admin_force', triggered_by: user.id },
          }).select('id').maybeSingle();

          await admin.from('gateway_webhook_events').insert({
            merchant_id: merchantId, event_type: 'settlement.paid',
            payload: { settlement_id: stm?.id, amount: sweep, currency: w.currency, cycle: 'admin_force' },
          });

          settled.push({ currency: w.currency, amount: sweep, settlement_id: stm?.id });
        }
        return new Response(JSON.stringify({ success: true, merchant_id: merchantId, settled }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'set_frequency': {
        const { merchant_id, frequency } = body;
        const allowed = ['instant', 'daily', 'weekly', 'monthly'];
        if (!merchant_id || !allowed.includes(frequency)) {
          return new Response(JSON.stringify({ error: 'invalid params', allowed }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error } = await admin
          .from('gateway_merchants')
          .update({ settlement_frequency: frequency, updated_at: new Date().toISOString() })
          .eq('id', merchant_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, merchant_id, frequency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'settle_all_pending': {
        // Sweep ALL merchants with pending balance > 0 (admin emergency tool).
        const { data: wallets } = await admin
          .from('gateway_merchant_wallets')
          .select('id, merchant_id, currency, pending_balance, available_balance')
          .gt('pending_balance', 0);

        const now = new Date().toISOString();
        const results: any[] = [];
        for (const w of wallets || []) {
          const sweep = Number(w.pending_balance);
          const { error } = await admin
            .from('gateway_merchant_wallets')
            .update({
              pending_balance: 0,
              available_balance: Number(w.available_balance) + sweep,
              last_instant_settled_at: now,
              updated_at: now,
            })
            .eq('id', w.id)
            .eq('pending_balance', w.pending_balance);
          if (error) continue;

          const { data: stm } = await admin.from('gateway_settlements').insert({
            merchant_id: w.merchant_id,
            amount: sweep, fees_total: 0, net_amount: sweep,
            currency: w.currency, status: 'settled',
            period_start: now, period_end: now,
            metadata: { cycle: 'admin_bulk', triggered_by: user.id },
          }).select('id').maybeSingle();

          results.push({ merchant_id: w.merchant_id, currency: w.currency, amount: sweep, settlement_id: stm?.id });
        }
        return new Response(JSON.stringify({ success: true, settled_count: results.length, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({
          error: 'unknown_action',
          allowed_actions: ['stats', 'list_merchants', 'force_settle', 'set_frequency', 'settle_all_pending'],
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (e: any) {
    console.error('admin-settlement-manager error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
