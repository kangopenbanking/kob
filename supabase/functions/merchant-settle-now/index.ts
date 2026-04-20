// Manual on-demand settlement for the authenticated merchant owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Find merchant owned by user
  const { data: merchant } = await supabase
    .from('gateway_merchants')
    .select('id, business_name, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return new Response(JSON.stringify({ error: 'merchant_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  // Allow active/approved merchants. Block draft/suspended/banned.
  const allowedStatuses = ['active', 'approved'];
  if (!allowedStatuses.includes(merchant.status)) {
    return new Response(JSON.stringify({
      error: 'merchant_not_active',
      message: `Merchant status is "${merchant.status}". Only active merchants can settle.`
    }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: wallets } = await admin
    .from('gateway_merchant_wallets')
    .select('id, currency, pending_balance, available_balance')
    .eq('merchant_id', merchant.id)
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
      merchant_id: merchant.id,
      amount: sweep, fees_total: 0, net_amount: sweep,
      currency: w.currency, status: 'settled',
      period_start: now, period_end: now,
      metadata: { cycle: 'manual', triggered_by: user.id },
    }).select('id').maybeSingle();

    await admin.from('gateway_webhook_events').insert({
      merchant_id: merchant.id, event_type: 'settlement.paid',
      payload: { settlement_id: stm?.id, amount: sweep, currency: w.currency, cycle: 'manual' },
    });

    settled.push({ currency: w.currency, amount: sweep, settlement_id: stm?.id });
  }

  return new Response(JSON.stringify({
    success: true,
    merchant_id: merchant.id,
    settled,
    total_wallets: settled.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
