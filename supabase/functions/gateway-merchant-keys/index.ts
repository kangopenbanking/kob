import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return problem(401, 'Unauthorized', 'Invalid or expired token');

    const method = req.method;
    const body = method !== 'GET' ? await req.json() : {};
    const action = body.action;

    // Support both REST-style methods and action-based invocation
    if (method === 'POST' && (!action || action === 'create')) {
      const { merchant_id, environment = 'sandbox', label } = body;
      if (!merchant_id) return problem(400, 'Bad Request', 'merchant_id is required');

      const { data: merchant } = await supabase.from('gateway_merchants').select('id, kyb_status, live_mode_enabled').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return problem(404, 'Not Found', 'Merchant not found or not authorized');

      const env = environment;
      if (env === 'live') {
        if (merchant.kyb_status !== 'approved') {
          return problem(403, 'KYB Required', 'KYB must be completed and approved before creating production API keys.');
        }
        if (!merchant.live_mode_enabled) {
          return problem(403, 'Live Mode Disabled', 'Enable Go Live mode for this merchant before creating production API keys.');
        }
      }
      const prefix = env === 'live' ? 'pk_live_' : 'pk_test_';
      const secretPrefix = env === 'live' ? 'sk_live_' : 'sk_test_';
      const publicKey = prefix + crypto.randomUUID().replace(/-/g, '');
      const secretKey = secretPrefix + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(secretKey));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      // Insert into gateway_merchant_keys (new table)
      const { data: apiKey, error } = await supabase.from('gateway_merchant_keys').insert({
        merchant_id,
        environment: env,
        public_key: publicKey,
        secret_key_hash: hashHex,
        label: label || 'Unnamed Key',
      }).select().single();

      if (error) throw error;

      // Also insert into legacy table for backward compat (best-effort)
      try {
        await supabase.from('gateway_merchant_api_keys').insert({
          merchant_id,
          environment: env,
          api_key_prefix: publicKey.slice(0, 16),
          api_key_hash: hashHex,
          label: label || 'Unnamed Key',
        });
      } catch (legacyErr) {
        console.warn('Legacy gateway_merchant_api_keys insert skipped:', legacyErr);
      }

      // Update count
      const { count } = await supabase
        .from('gateway_merchant_keys')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant_id)
        .eq('is_active', true);

      await supabase
        .from('gateway_merchants')
        .update({ api_keys_count: count || 0 })
        .eq('id', merchant_id);

      return new Response(JSON.stringify({
        ...apiKey,
        merchant_id,
        secret_key: secretKey,
        warning: 'Store this key securely. It will not be shown again.',
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'revoke' || method === 'DELETE') {
      const { key_id, merchant_id } = body;
      if (!key_id || !merchant_id) return problem(400, 'Bad Request', 'key_id and merchant_id are required');

      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return problem(404, 'Not Found', 'Merchant not found or not authorized');

      await supabase.from('gateway_merchant_keys')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('id', key_id)
        .eq('merchant_id', merchant_id);

      return new Response(JSON.stringify({ status: 'revoked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list' || method === 'GET') {
      const merchantId = body.merchant_id || new URL(req.url).searchParams.get('merchant_id');
      if (!merchantId) return problem(400, 'Bad Request', 'merchant_id required');

      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).single();
      if (!merchant) return problem(404, 'Not Found', 'Merchant not found or not authorized');

      const { data: keys } = await supabase.from('gateway_merchant_keys')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({ data: keys || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'rotate') {
      const { key_id, merchant_id, environment, label } = body;
      if (!key_id || !merchant_id) return problem(400, 'Bad Request', 'key_id and merchant_id are required');

      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return problem(404, 'Not Found', 'Merchant not found or not authorized');

      // Revoke old key
      await supabase.from('gateway_merchant_keys').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', key_id).eq('merchant_id', merchant_id);

      // Create new key
      const env = environment || 'sandbox';
      const prefix = env === 'live' ? 'pk_live_' : 'pk_test_';
      const secretPrefix = env === 'live' ? 'sk_live_' : 'sk_test_';
      const publicKey = prefix + crypto.randomUUID().replace(/-/g, '');
      const secretKey = secretPrefix + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(secretKey));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: newKey, error } = await supabase.from('gateway_merchant_keys').insert({
        merchant_id, environment: env, public_key: publicKey, secret_key_hash: hashHex, label: label || 'Rotated key',
      }).select().single();
      if (error) throw error;

      return new Response(JSON.stringify({ ...newKey, merchant_id, secret_key: secretKey, revoked_key_id: key_id, warning: 'Store this key securely.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return problem(405, 'Method Not Allowed', `Unsupported action: ${action || method}`);
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-merchant-keys error:`, err);
    return problem(500, 'Internal Server Error', `An unexpected error occurred. Reference: ${errorId}`);
  }
});
