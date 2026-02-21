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
    const type = url.searchParams.get('type') || 'charges'; // charges, payouts, refunds

    const { data: merchants } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id);
    const merchantIds = merchants?.map(m => m.id) || [];
    if (merchantIds.length === 0) return new Response('', { headers: { ...corsHeaders, 'Content-Type': 'text/csv' } });

    const targetIds = merchantId && merchantIds.includes(merchantId) ? [merchantId] : merchantIds;

    let rows: string[] = [];

    if (type === 'charges') {
      rows.push('id,merchant_id,amount,currency,channel,status,provider,fee_amount,net_amount,customer_email,customer_phone,tx_ref,created_at');
      let q = supabase.from('gateway_charges').select('*').in('merchant_id', targetIds);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      const { data } = await q.order('created_at', { ascending: false }).limit(1000);
      for (const c of (data || [])) {
        rows.push([c.id, c.merchant_id, c.amount, c.currency, c.channel, c.status, c.provider, c.fee_amount, c.net_amount, c.customer_email || '', c.customer_phone || '', c.tx_ref, c.created_at].join(','));
      }
    } else if (type === 'payouts') {
      rows.push('id,merchant_id,amount,currency,channel,status,provider,fee_amount,beneficiary_name,beneficiary_phone,tx_ref,created_at');
      let q = supabase.from('gateway_payouts').select('*').in('merchant_id', targetIds);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      const { data } = await q.order('created_at', { ascending: false }).limit(1000);
      for (const p of (data || [])) {
        rows.push([p.id, p.merchant_id, p.amount, p.currency, p.channel, p.status, p.provider, p.fee_amount, p.beneficiary_name || '', p.beneficiary_phone || '', p.tx_ref, p.created_at].join(','));
      }
    } else {
      rows.push('id,merchant_id,charge_id,amount,currency,status,reason,created_at');
      let q = supabase.from('gateway_refunds').select('*').in('merchant_id', targetIds);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      const { data } = await q.order('created_at', { ascending: false }).limit(1000);
      for (const r of (data || [])) {
        rows.push([r.id, r.merchant_id, r.charge_id, r.amount, r.currency, r.status, r.reason || '', r.created_at].join(','));
      }
    }

    return new Response(rows.join('\n'), { headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type}_export.csv"` } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
