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

    const url = new URL(req.url);
    const merchantId = url.searchParams.get('merchant_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const format = url.searchParams.get('format') || 'json'; // json or csv

    const { data: merchants } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id);
    const merchantIds = merchants?.map(m => m.id) || [];
    if (merchantIds.length === 0) return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const targetIds = merchantId && merchantIds.includes(merchantId) ? [merchantId] : merchantIds;

    // Charges
    let chargesQ = supabase.from('gateway_charges').select('id, merchant_id, amount, currency, channel, status, fee_amount, net_amount, tx_ref, created_at').in('merchant_id', targetIds);
    if (from) chargesQ = chargesQ.gte('created_at', from);
    if (to) chargesQ = chargesQ.lte('created_at', to);
    const { data: charges } = await chargesQ.order('created_at', { ascending: false }).limit(500);

    // Payouts
    let payoutsQ = supabase.from('gateway_payouts').select('id, merchant_id, amount, currency, channel, status, fee_amount, tx_ref, created_at').in('merchant_id', targetIds);
    if (from) payoutsQ = payoutsQ.gte('created_at', from);
    if (to) payoutsQ = payoutsQ.lte('created_at', to);
    const { data: payouts } = await payoutsQ.order('created_at', { ascending: false }).limit(500);

    // Refunds
    let refundsQ = supabase.from('gateway_refunds').select('id, merchant_id, charge_id, amount, currency, status, created_at').in('merchant_id', targetIds);
    if (from) refundsQ = refundsQ.gte('created_at', from);
    if (to) refundsQ = refundsQ.lte('created_at', to);
    const { data: refunds } = await refundsQ.order('created_at', { ascending: false }).limit(500);

    const summary = {
      total_charges: (charges || []).length,
      total_charge_amount: (charges || []).filter(c => c.status === 'successful').reduce((s, c) => s + c.amount, 0),
      total_fees: (charges || []).filter(c => c.status === 'successful').reduce((s, c) => s + (c.fee_amount || 0), 0),
      total_payouts: (payouts || []).length,
      total_payout_amount: (payouts || []).filter(p => p.status === 'successful').reduce((s, p) => s + p.amount, 0),
      total_refunds: (refunds || []).length,
      total_refund_amount: (refunds || []).filter(r => r.status === 'successful').reduce((s, r) => s + r.amount, 0),
    };

    if (format === 'csv') {
      const rows = [['type','id','amount','currency','channel','status','tx_ref','created_at'].join(',')];
      for (const c of (charges || [])) rows.push(['charge', c.id, c.amount, c.currency, c.channel, c.status, c.tx_ref, c.created_at].join(','));
      for (const p of (payouts || [])) rows.push(['payout', p.id, p.amount, p.currency, p.channel, p.status, p.tx_ref, p.created_at].join(','));
      for (const r of (refunds || [])) rows.push(['refund', r.id, r.amount, r.currency, '', r.status, '', r.created_at].join(','));
      return new Response(rows.join('\n'), { headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="transactions.csv"' } });
    }

    return new Response(JSON.stringify({ summary, charges, payouts, refunds }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
