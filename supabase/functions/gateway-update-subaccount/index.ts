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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { subaccount_id, subaccount_name, settlement_bank, account_number, split_type, split_value, is_active } = body;

    if (!subaccount_id) return new Response(JSON.stringify({ error: 'subaccount_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: sub } = await supabase
      .from('gateway_subaccounts')
      .select('*, gateway_merchants!inner(user_id)')
      .eq('id', subaccount_id)
      .single();

    if (!sub || sub.gateway_merchants.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const updates: Record<string, unknown> = {};
    if (subaccount_name !== undefined) updates.subaccount_name = subaccount_name;
    if (settlement_bank !== undefined) updates.settlement_bank = settlement_bank;
    if (account_number !== undefined) updates.account_number = account_number;
    if (split_type !== undefined) updates.split_type = split_type;
    if (split_value !== undefined) updates.split_value = split_value;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: updated, error: updateErr } = await supabase
      .from('gateway_subaccounts')
      .update(updates)
      .eq('id', subaccount_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] update-subaccount error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
