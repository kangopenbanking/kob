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
    const currency = url.searchParams.get('currency') || 'XAF';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!merchantId) return new Response(JSON.stringify({ error: 'missing_merchant_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Combine charges, refunds, and payouts into a unified ledger
    const ledger = [];

    // Fetch charges (credits)
    const { data: charges } = await supabase
      .from('gateway_charges')
      .select('id, amount, currency, status, created_at, tx_ref, metadata')
      .eq('merchant_id', merchantId)
      .eq('currency', currency)
      .eq('status', 'successful')
      .order('created_at', { ascending: false });

    charges?.forEach(c => ledger.push({
      id: c.id,
      type: 'charge',
      direction: 'credit',
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      reference: c.tx_ref,
      created_at: c.created_at,
      metadata: c.metadata,
    }));

    // Fetch refunds (debits)
    const { data: refunds } = await supabase
      .from('gateway_refunds')
      .select('id, amount, currency, status, created_at, refund_ref, metadata')
      .eq('merchant_id', merchantId)
      .eq('currency', currency)
      .eq('status', 'successful')
      .order('created_at', { ascending: false });

    refunds?.forEach(r => ledger.push({
      id: r.id,
      type: 'refund',
      direction: 'debit',
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      reference: r.refund_ref,
      created_at: r.created_at,
      metadata: r.metadata,
    }));

    // Fetch payouts (debits)
    const { data: payouts } = await supabase
      .from('gateway_payouts')
      .select('id, amount, currency, status, created_at, tx_ref, metadata')
      .eq('merchant_id', merchantId)
      .eq('currency', currency)
      .in('status', ['successful', 'pending', 'processing'])
      .order('created_at', { ascending: false });

    payouts?.forEach(p => ledger.push({
      id: p.id,
      type: 'payout',
      direction: 'debit',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      reference: p.tx_ref,
      created_at: p.created_at,
      metadata: p.metadata,
    }));

    // Sort by date descending and paginate
    ledger.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paginatedLedger = ledger.slice(offset, offset + limit);

    return new Response(JSON.stringify({ data: paginatedLedger, total: ledger.length, limit, offset }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
