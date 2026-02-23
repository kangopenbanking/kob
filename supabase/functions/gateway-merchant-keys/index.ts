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
    const method = req.method;

    if (method === 'POST') {
      // Create a new API key
      const { merchant_id, environment = 'sandbox', label } = await req.json();
      if (!merchant_id) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Generate API key
      const rawKey = crypto.randomUUID() + '-' + crypto.randomUUID();
      const prefix = environment === 'sandbox' ? `sk_test_${rawKey.slice(0, 8)}` : `sk_live_${rawKey.slice(0, 8)}`;
      const fullKey = `${prefix}_${rawKey}`;

      // Hash the key
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fullKey));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: apiKey, error } = await supabase.from('gateway_merchant_api_keys').insert({
        merchant_id, environment, api_key_prefix: prefix, api_key_hash: hashHex, label,
      }).select('id, merchant_id, environment, api_key_prefix, label, is_active, created_at').single();

      if (error) throw error;

      // Return the full key ONCE (won't be retrievable again)
      return new Response(JSON.stringify({ ...apiKey, api_key: fullKey, warning: 'Store this key securely. It will not be shown again.' }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'GET') {
      // List API keys for merchant
      const merchantId = url.searchParams.get('merchant_id');
      if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: keys } = await supabase.from('gateway_merchant_api_keys')
        .select('id, merchant_id, environment, api_key_prefix, label, is_active, last_used_at, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({ data: keys || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'DELETE') {
      const { key_id, merchant_id } = await req.json();
      if (!key_id || !merchant_id) return new Response(JSON.stringify({ error: 'key_id and merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabase.from('gateway_merchant_api_keys').update({ is_active: false }).eq('id', key_id).eq('merchant_id', merchant_id);

      return new Response(JSON.stringify({ status: 'revoked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PATCH - Rotate key (revoke old + create new atomically)
    if (method === 'PATCH') {
      const { key_id, merchant_id, environment, label } = await req.json();
      if (!key_id || !merchant_id) return new Response(JSON.stringify({ error: 'key_id and merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Revoke old key
      await supabase.from('gateway_merchant_api_keys').update({ is_active: false }).eq('id', key_id).eq('merchant_id', merchant_id);

      // Create new key
      const env = environment || 'sandbox';
      const rawKey = crypto.randomUUID() + '-' + crypto.randomUUID();
      const prefix = env === 'sandbox' ? `sk_test_${rawKey.slice(0, 8)}` : `sk_live_${rawKey.slice(0, 8)}`;
      const fullKey = `${prefix}_${rawKey}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fullKey));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: newKey, error } = await supabase.from('gateway_merchant_api_keys').insert({
        merchant_id, environment: env, api_key_prefix: prefix, api_key_hash: hashHex, label: label || 'Rotated key',
      }).select('id, merchant_id, environment, api_key_prefix, label, is_active, created_at').single();
      if (error) throw error;

      return new Response(JSON.stringify({ ...newKey, api_key: fullKey, revoked_key_id: key_id, warning: 'Store this key securely. It will not be shown again.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
