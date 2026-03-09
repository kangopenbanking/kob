import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { merchant_id, email, bvn, currency = 'NGN', is_permanent = false, narration } = await req.json();
    if (!merchant_id || !email) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id and email are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const flwKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${flwKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, is_permanent, bvn: bvn || undefined, narration: narration || `KOB-${merchant.business_name}`,
        tx_ref: `va-${merchant_id}-${Date.now()}`,
      }),
    });
    const flwData = await flwRes.json();

    if (flwData.status !== 'success') throw new Error(flwData.message || 'Failed to create virtual account');

    const vaData = flwData.data;
    const { data: va } = await supabase.from('gateway_virtual_accounts').insert({
      merchant_id, account_number: vaData.account_number, bank_name: vaData.bank_name,
      provider_ref: vaData.flw_ref || vaData.order_ref, currency, email, bvn,
      expiry: vaData.expiry_date || null, metadata: { provider_raw: vaData },
    }).select().single();

    return new Response(JSON.stringify(va), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] create-virtual-account error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
