import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const method = req.method;
    const merchantId = url.searchParams.get('merchant_id');
    const accountId = url.searchParams.get('account_id');

    if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify ownership
    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (method === 'GET') {
      const { data, error } = await supabase.from('gateway_merchant_settlement_accounts')
        .select('*').eq('merchant_id', merchantId).eq('is_active', true).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'POST') {
      const body = await req.json();
      const { account_type, bank_code, bank_name, account_number, account_name, phone_number, currency, is_default } = body;
      if (!account_number) return new Response(JSON.stringify({ error: 'account_number required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // If setting as default, unset others
      if (is_default) {
        await supabase.from('gateway_merchant_settlement_accounts').update({ is_default: false }).eq('merchant_id', merchantId);
      }

      const { data, error } = await supabase.from('gateway_merchant_settlement_accounts').insert({
        merchant_id: merchantId, account_type: account_type || 'bank_transfer',
        bank_code, bank_name, account_number, account_name, phone_number,
        currency: currency || 'XAF', is_default: is_default || false,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'PATCH') {
      if (!accountId) return new Response(JSON.stringify({ error: 'account_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const body = await req.json();
      const updates: Record<string, unknown> = {};
      for (const key of ['bank_code', 'bank_name', 'account_number', 'account_name', 'phone_number', 'currency', 'is_default']) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (body.is_default) {
        await supabase.from('gateway_merchant_settlement_accounts').update({ is_default: false }).eq('merchant_id', merchantId);
      }
      const { data, error } = await supabase.from('gateway_merchant_settlement_accounts').update(updates).eq('id', accountId).eq('merchant_id', merchantId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'DELETE') {
      if (!accountId) return new Response(JSON.stringify({ error: 'account_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await supabase.from('gateway_merchant_settlement_accounts').update({ is_active: false }).eq('id', accountId).eq('merchant_id', merchantId);
      return new Response(JSON.stringify({ status: 'deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] merchant-settlement-accounts error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
