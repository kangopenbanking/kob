import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout } from "../_shared/gateway-adapters.ts";

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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { payout_id } = body;
    if (!payout_id) return new Response(JSON.stringify({ error: 'payout_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get payout and verify ownership
    const { data: payout } = await supabase
      .from('gateway_payouts')
      .select('*, gateway_merchants!inner(user_id)')
      .eq('id', payout_id)
      .single();

    if (!payout || payout.gateway_merchants.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (payout.status !== 'failed') {
      return new Response(JSON.stringify({ error: 'invalid_status', message: 'Only failed payouts can be retried' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate new tx_ref for retry
    const retryRef = `${payout.tx_ref}-retry-${Date.now()}`;

    // Update status to pending
    await supabase.from('gateway_payouts').update({ status: 'pending', failure_reason: null }).eq('id', payout_id);

    try {
      const result = await createFlutterwavePayout({
        amount: payout.amount,
        currency: payout.currency,
        channel: payout.channel,
        beneficiary_account: payout.beneficiary_account,
        beneficiary_bank: payout.beneficiary_bank,
        beneficiary_phone: payout.beneficiary_phone,
        beneficiary_name: payout.beneficiary_name,
        narration: payout.narration,
        tx_ref: retryRef,
      });

      await supabase.from('gateway_payouts').update({
        status: result.status === 'successful' ? 'completed' : result.status,
        provider_ref: result.provider_ref,
        provider_raw: result.provider_raw,
      }).eq('id', payout_id);

      payout.status = result.status;
      payout.provider_ref = result.provider_ref;
    } catch (providerErr) {
      await supabase.from('gateway_payouts').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', payout_id);
      payout.status = 'failed';
      payout.failure_reason = providerErr.message;
    }

    // Audit
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_payout_retry', entity_type: 'gateway_payout', entity_id: payout_id,
      performed_by: user.id, details: { retry_ref: retryRef, status: payout.status },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify(payout), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] retry-payout error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
