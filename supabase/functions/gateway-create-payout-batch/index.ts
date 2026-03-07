import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, calculateGatewayFeeSync } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { merchant_id, currency = 'XAF', items } = body;

    if (!merchant_id || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'merchant_id and items[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const totalAmount = items.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);

    const { data: batch, error: batchErr } = await supabase.from('gateway_payout_batches').insert({
      merchant_id, total_amount: totalAmount, currency, status: 'processing',
      item_count: items.length, idempotency_key: req.headers.get('idempotency-key'),
    }).select().single();

    if (batchErr) throw batchErr;

    // Create individual payouts
    let completed = 0, failed = 0;
    for (const item of items) {
      const { fee } = calculateGatewayFee(item.amount, item.channel || 'mobile_money');
      const txRef = `batch_${batch.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const { data: payout } = await supabase.from('gateway_payouts').insert({
        merchant_id, amount: item.amount, currency, channel: item.channel || 'mobile_money',
        status: 'pending', provider: 'flutterwave', beneficiary_name: item.beneficiary_name,
        beneficiary_account: item.beneficiary_account, beneficiary_bank: item.beneficiary_bank,
        beneficiary_phone: item.beneficiary_phone, narration: item.narration, tx_ref: txRef,
        fee_amount: fee, batch_id: batch.id, metadata: item.metadata || {},
      }).select().single();

      try {
        const result = await createFlutterwavePayout({ ...item, tx_ref: txRef, currency });
        await supabase.from('gateway_payouts').update({ status: result.status, provider_ref: result.provider_ref, provider_raw: result.provider_raw }).eq('id', payout!.id);
        if (result.status === 'successful') completed++;
        else if (result.status === 'failed') failed++;
      } catch {
        await supabase.from('gateway_payouts').update({ status: 'failed' }).eq('id', payout!.id);
        failed++;
      }
    }

    const batchStatus = failed === items.length ? 'failed' : failed > 0 ? 'partial_failure' : 'completed';
    await supabase.from('gateway_payout_batches').update({ status: batchStatus, completed_count: completed, failed_count: failed }).eq('id', batch.id);

    return new Response(JSON.stringify({ ...batch, status: batchStatus, completed_count: completed, failed_count: failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
