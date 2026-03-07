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

    const body = await req.json();
    const { merchant_id, subaccount_name, settlement_bank, account_number, split_type = 'percentage', split_value, currency = 'XAF', metadata } = body;

    if (!merchant_id || !subaccount_name || split_value === undefined) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, subaccount_name, split_value are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (split_type === 'percentage' && (split_value < 0 || split_value > 100)) {
      return new Response(JSON.stringify({ error: 'invalid_split_value', message: 'Percentage must be 0-100' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: subaccount, error: insertErr } = await supabase.from('gateway_subaccounts').insert({
      merchant_id, subaccount_name, settlement_bank, account_number, split_type, split_value, currency, metadata: metadata || {},
    }).select().single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify(subaccount), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
