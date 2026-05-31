import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { ensureSandboxMerchantId } from "../_shared/sandbox-merchant.ts";
import {
  clientIpFrom,
  extractTurnstileToken,
  logTurnstileDecision,
  turnstileEnforceEnabled,
  verifyTurnstile,
} from "../_shared/turnstile.ts";
import { enforceDeveloperVelocity } from "../_shared/developer-velocity.ts";

function randHex(len: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Velocity gate ---
    const velocity = await enforceDeveloperVelocity(req, 'sandbox-create-api-key', user.id);
    if (velocity) return velocity;

    // --- Cloudflare Turnstile bot gate (shadow-mode by default) ---
    const ts_token = await extractTurnstileToken(req);
    const ts_ip = clientIpFrom(req);
    const ts_result = await verifyTurnstile(ts_token, ts_ip);
    await logTurnstileDecision(supabase, {
      endpoint: 'sandbox-create-api-key',
      user_id: user.id,
      ip: ts_ip,
      result: ts_result,
    });
    if (turnstileEnforceEnabled() && !ts_result.ok) {
      return new Response(
        JSON.stringify({
          error: 'turnstile_failed',
          reason: ts_result.reason,
          codes: ts_result.codes,
          retryable: true,
          message: 'Bot verification failed. Please complete the challenge again and retry.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }


    const { key_name, tier: requestedTier } = await req.json().catch(() => ({}));
    const VALID_TIERS = new Set(['free', 'pro', 'enterprise']);
    const tier = (typeof requestedTier === 'string' && VALID_TIERS.has(requestedTier)) ? requestedTier : 'free';

    const { data: account, error: accountError } = await supabase
      .from('developer_sandbox_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'No active sandbox account found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantId = await ensureSandboxMerchantId(supabase, user, {
      accountId: account.id,
      companyName: account.company_name,
    });

    const { count } = await supabase
      .from('sandbox_api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('sandbox_account_id', account.id)
      .eq('is_active', true);

    if (count && count >= 5) {
      return new Response(JSON.stringify({ error: 'Maximum number of API keys reached (5)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full credential set
    const secretKey = 'sk_test_' + randHex(32);
    const publishableKey = 'pk_test_' + randHex(24);
    const webhookSecret = 'whsec_test_' + randHex(32);
    const sbxLegacyKey = 'sbx_' + randHex(32);

    const [keyHash, webhookHash] = await Promise.all([sha256(secretKey), sha256(webhookSecret)]);

    const rateLimits = {
      free: { per_minute: 60, per_day: 1000 },
      basic: { per_minute: 300, per_day: 10000 },
      pro: { per_minute: 1000, per_day: 100000 },
    } as const;
    const limits = rateLimits[account.tier as keyof typeof rateLimits] || rateLimits.free;

    const { data: newKey, error: insertError } = await supabase
      .from('sandbox_api_keys')
      .insert([{
        sandbox_account_id: account.id,
        key_name: key_name || 'Default Key',
        api_key: sbxLegacyKey,
        key_hash: keyHash,
        publishable_key: publishableKey,
        webhook_secret_hash: webhookHash,
        webhook_secret_preview: webhookSecret.slice(0, 16) + '…',
        rate_limit_per_minute: limits.per_minute,
        rate_limit_per_day: limits.per_day,
        tier,
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('Created sandbox API key set:', newKey.id);

    return new Response(JSON.stringify({
      key_id: newKey.id,
      key_name: newKey.key_name,
      secret_key: secretKey,
      publishable_key: publishableKey,
      merchant_id: merchantId,
      webhook_secret: webhookSecret,
      environment: 'sandbox',
      tier,
      rate_limits: limits,
      message: 'Save these credentials now. The secret key and webhook secret will not be shown again. The publishable key and merchant ID can be retrieved later.',
      // Backward-compatible alias
      api_key: secretKey,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error) {
    console.error('Error creating sandbox API key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create API key. Please try again.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
