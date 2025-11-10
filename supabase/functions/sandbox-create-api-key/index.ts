import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as crypto from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateApiKey(): string {
  const prefix = 'sbx_';
  const randomBytes = crypto.randomBytes(32);
  return prefix + randomBytes.toString('hex');
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
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

    const { key_name } = await req.json();

    // Get user's sandbox account
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

    // Check existing API key count
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

    // Generate new API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Set rate limits based on tier
    const rateLimits = {
      free: { per_minute: 60, per_day: 1000 },
      basic: { per_minute: 300, per_day: 10000 },
      pro: { per_minute: 1000, per_day: 100000 },
    };

    const limits = rateLimits[account.tier as keyof typeof rateLimits] || rateLimits.free;

    const { data: newKey, error: insertError } = await supabase
      .from('sandbox_api_keys')
      .insert([{
        sandbox_account_id: account.id,
        key_name: key_name || 'Default Key',
        api_key: apiKey,
        key_hash: keyHash,
        rate_limit_per_minute: limits.per_minute,
        rate_limit_per_day: limits.per_day,
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('Created sandbox API key:', newKey.id);

    // Return the API key only once
    return new Response(JSON.stringify({ 
      api_key: apiKey,
      key_id: newKey.id,
      key_name: newKey.key_name,
      rate_limits: {
        per_minute: limits.per_minute,
        per_day: limits.per_day,
      },
      message: 'Save this API key securely - it will not be shown again'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error) {
    console.error('Error creating sandbox API key:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create API key',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});