import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    const { charge_id, otp, flw_ref } = await req.json();
    if (!charge_id || !otp) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'charge_id and otp are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get charge
    const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', charge_id).single();
    if (!charge || charge.gateway_merchants.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (charge.status !== 'processing' && charge.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'invalid_state', message: `Charge is already ${charge.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const ref = flw_ref || charge.provider_ref;

    const flwRes = await fetch('https://api.flutterwave.com/v3/validate-charge', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${flutterwaveSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, flw_ref: ref }),
    });

    const flwData = await flwRes.json();
    const newStatus = flwData.status === 'success' ? 'successful' : 'failed';

    await supabase.from('gateway_charges').update({
      status: newStatus,
      provider_raw: flwData,
    }).eq('id', charge.id);

    // Update wallet on success
    if (newStatus === 'successful') {
      await supabase.rpc('update_merchant_wallet', {
        _merchant_id: charge.merchant_id,
        _currency: charge.currency,
        _pending_delta: charge.net_amount || charge.amount,
        _ledger_delta: charge.net_amount || charge.amount,
      });
    }

    await supabase.from('gateway_charge_events').insert({
      charge_id: charge.id, event_type: `charge.${newStatus}`,
      details: { via: 'otp_validation', flw_ref: ref },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ id: charge.id, status: newStatus, message: flwData.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] validate-charge error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
