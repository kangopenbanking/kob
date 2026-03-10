import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return problem(401, 'Unauthorized', 'Invalid or expired token');

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'transactions';
    const url = new URL(req.url);
    const merchantId = body.merchant_id || url.searchParams.get('merchant_id');
    const from = body.from || url.searchParams.get('from');
    const to = body.to || url.searchParams.get('to');

    // Verify access
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    const { data: merchants } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id);
    const merchantIds = merchants?.map(m => m.id) || [];

    if (merchantId && !isAdmin) {
      if (!merchantIds.includes(merchantId)) return problem(403, 'Forbidden', 'Not authorized for this merchant');
    }

    const targetIds = merchantId ? [merchantId] : merchantIds;
    if (targetIds.length === 0 && !isAdmin) {
      return new Response(JSON.stringify({ data: [], summary: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    switch (action) {
      case 'fees': return await handleFees(supabase, targetIds, from, to, isAdmin, merchantId);
      case 'settlements': return await handleSettlements(supabase, targetIds, from, to);
      case 'transactions': return await handleTransactions(supabase, targetIds, from, to, body.format || 'json');
      default: return problem(400, 'Bad Request', `Unknown action: ${action}`);
    }
  } catch (err: any) {
    return problem(500, 'Internal Server Error', err.message);
  }
});

async function handleFees(supabase: any, targetIds: string[], from: string | null, to: string | null, isAdmin: boolean, merchantId: string | null) {
  let query = supabase.from('gateway_charges').select('merchant_id, amount, fee_amount, net_amount, channel, currency, status, created_at')
    .eq('status', 'successful');
  if (merchantId) query = query.eq('merchant_id', merchantId);
  else if (!isAdmin && targetIds.length > 0) query = query.in('merchant_id', targetIds);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  query = query.order('created_at', { ascending: false }).limit(1000);

  const { data: charges, error } = await query;
  if (error) throw error;

  const summary = {
    total_charges: charges?.length || 0, total_volume: 0, total_fees: 0, total_net: 0,
    by_channel: {} as Record<string, { count: number; volume: number; fees: number }>,
    by_currency: {} as Record<string, { count: number; volume: number; fees: number }>,
  };
  for (const charge of charges || []) {
    summary.total_volume += charge.amount || 0;
    summary.total_fees += charge.fee_amount || 0;
    summary.total_net += charge.net_amount || 0;
    const ch = charge.channel || 'unknown';
    if (!summary.by_channel[ch]) summary.by_channel[ch] = { count: 0, volume: 0, fees: 0 };
    summary.by_channel[ch].count++; summary.by_channel[ch].volume += charge.amount || 0; summary.by_channel[ch].fees += charge.fee_amount || 0;
    const cur = charge.currency || 'XAF';
    if (!summary.by_currency[cur]) summary.by_currency[cur] = { count: 0, volume: 0, fees: 0 };
    summary.by_currency[cur].count++; summary.by_currency[cur].volume += charge.amount || 0; summary.by_currency[cur].fees += charge.fee_amount || 0;
  }
  return new Response(JSON.stringify({ data: summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleSettlements(supabase: any, targetIds: string[], from: string | null, to: string | null) {
  if (targetIds.length === 0) return new Response(JSON.stringify({ data: [], summary: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  let query = supabase.from('gateway_settlements').select('*').in('merchant_id', targetIds);
  if (from) query = query.gte('period_start', from);
  if (to) query = query.lte('period_end', to);
  const { data: settlements, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const summary = {
    total_settlements: (settlements || []).length,
    total_settled: (settlements || []).filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.amount || 0), 0),
    total_pending: (settlements || []).filter((s: any) => s.status === 'pending').reduce((sum: number, s: any) => sum + (s.amount || 0), 0),
    total_fees: (settlements || []).reduce((sum: number, s: any) => sum + (s.fees_total || 0), 0),
  };
  return new Response(JSON.stringify({ summary, data: settlements }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleTransactions(supabase: any, targetIds: string[], from: string | null, to: string | null, format: string) {
  if (targetIds.length === 0) return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let chargesQ = supabase.from('gateway_charges').select('id, merchant_id, amount, currency, channel, status, fee_amount, net_amount, tx_ref, created_at').in('merchant_id', targetIds);
  if (from) chargesQ = chargesQ.gte('created_at', from);
  if (to) chargesQ = chargesQ.lte('created_at', to);
  const { data: charges } = await chargesQ.order('created_at', { ascending: false }).limit(500);

  let payoutsQ = supabase.from('gateway_payouts').select('id, merchant_id, amount, currency, channel, status, fee_amount, tx_ref, created_at').in('merchant_id', targetIds);
  if (from) payoutsQ = payoutsQ.gte('created_at', from);
  if (to) payoutsQ = payoutsQ.lte('created_at', to);
  const { data: payouts } = await payoutsQ.order('created_at', { ascending: false }).limit(500);

  let refundsQ = supabase.from('gateway_refunds').select('id, merchant_id, charge_id, amount, currency, status, created_at').in('merchant_id', targetIds);
  if (from) refundsQ = refundsQ.gte('created_at', from);
  if (to) refundsQ = refundsQ.lte('created_at', to);
  const { data: refunds } = await refundsQ.order('created_at', { ascending: false }).limit(500);

  const summary = {
    total_charges: (charges || []).length,
    total_charge_amount: (charges || []).filter((c: any) => c.status === 'successful').reduce((s: number, c: any) => s + c.amount, 0),
    total_fees: (charges || []).filter((c: any) => c.status === 'successful').reduce((s: number, c: any) => s + (c.fee_amount || 0), 0),
    total_payouts: (payouts || []).length,
    total_payout_amount: (payouts || []).filter((p: any) => p.status === 'successful').reduce((s: number, p: any) => s + p.amount, 0),
    total_refunds: (refunds || []).length,
    total_refund_amount: (refunds || []).filter((r: any) => r.status === 'successful').reduce((s: number, r: any) => s + r.amount, 0),
  };

  if (format === 'csv') {
    const rows = [['type','id','amount','currency','channel','status','tx_ref','created_at'].join(',')];
    for (const c of (charges || [])) rows.push(['charge', c.id, c.amount, c.currency, c.channel, c.status, c.tx_ref, c.created_at].join(','));
    for (const p of (payouts || [])) rows.push(['payout', p.id, p.amount, p.currency, p.channel, p.status, p.tx_ref, p.created_at].join(','));
    for (const r of (refunds || [])) rows.push(['refund', r.id, r.amount, r.currency, '', r.status, '', r.created_at].join(','));
    return new Response(rows.join('\n'), { headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="transactions.csv"' } });
  }

  return new Response(JSON.stringify({ summary, charges, payouts, refunds }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
