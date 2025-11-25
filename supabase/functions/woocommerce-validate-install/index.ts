import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface ValidateRequest {
  api_key: string;
  plugin_version?: string;
  store_url?: string;
}

// Simple rate limiting using in-memory store (per edge function instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get API key from header or body
    let apiKey: string | null = req.headers.get('x-api-key');
    let pluginVersion: string | undefined;
    let storeUrl: string | undefined;

    if (!apiKey && req.method === 'POST') {
      const body: ValidateRequest = await req.json();
      apiKey = body.api_key;
      pluginVersion = body.plugin_version;
      storeUrl = body.store_url;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 100 requests per minute per API key
    const rateLimitKey = `validate:${apiKey}`;
    if (!checkRateLimit(rateLimitKey, 100, 60000)) {
      console.log(`Rate limit exceeded for API key`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'Maximum 100 requests per minute'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating API key');

    // Hash the API key to look up merchant
    const encoder = new TextEncoder();
    const apiKeyHash = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
    const apiKeyHashHex = Array.from(new Uint8Array(apiKeyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Find merchant by API key hash
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('woocommerce_merchants')
      .select('id, store_name, store_url, status, payment_methods, plugin_version')
      .eq('api_key_hash', apiKeyHashHex)
      .single();

    if (merchantError || !merchant) {
      console.error('Invalid API key');
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Invalid API key'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check merchant status
    if (merchant.status !== 'active') {
      console.log(`Merchant account is ${merchant.status}`);
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: `Merchant account is ${merchant.status}`,
          status: merchant.status
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update plugin version if provided
    if (pluginVersion && pluginVersion !== merchant.plugin_version) {
      await supabaseClient
        .from('woocommerce_merchants')
        .update({ plugin_version: pluginVersion })
        .eq('id', merchant.id);
    }

    // Update last sync time
    await supabaseClient
      .from('woocommerce_merchants')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', merchant.id);

    console.log(`API key validated successfully for merchant: ${merchant.id}`);

    // Return validation result with configuration
    return new Response(
      JSON.stringify({
        valid: true,
        merchant_id: merchant.id,
        store_name: merchant.store_name,
        configuration: {
          payment_methods: merchant.payment_methods,
          supported_currencies: ['XAF'],
          fee_structure: {
            percentage: 3.5,
            fixed_fee: 100,
            currency: 'XAF'
          }
        },
        message: 'API key is valid'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in woocommerce-validate-install:', error);
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
