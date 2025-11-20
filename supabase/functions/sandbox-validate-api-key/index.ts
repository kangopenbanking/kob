import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as crypto from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex') as string;
}

async function checkRateLimit(
  supabase: any,
  apiKeyId: string,
  rateLimitPerMinute: number,
  rateLimitPerDay: number
): Promise<{ allowed: boolean; message?: string }> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  const oneDayAgo = new Date(now.getTime() - 86400000);

  // Check minute limit
  const { count: minuteCount } = await supabase
    .from('sandbox_api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', oneMinuteAgo.toISOString());

  if (minuteCount && minuteCount >= rateLimitPerMinute) {
    return { allowed: false, message: `Rate limit exceeded: ${rateLimitPerMinute} requests per minute` };
  }

  // Check daily limit
  const { count: dailyCount } = await supabase
    .from('sandbox_api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', oneDayAgo.toISOString());

  if (dailyCount && dailyCount >= rateLimitPerDay) {
    return { allowed: false, message: `Rate limit exceeded: ${rateLimitPerDay} requests per day` };
  }

  return { allowed: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || !apiKey.startsWith('sbx_')) {
      return new Response(JSON.stringify({ error: 'Invalid API key format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyHash = hashApiKey(apiKey);

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .from('sandbox_api_keys')
      .select(`
        *,
        sandbox_account:developer_sandbox_accounts(*)
      `)
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return new Response(JSON.stringify({ error: 'Invalid or inactive API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if account is active
    if (keyData.sandbox_account.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Sandbox account is not active' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limits
    const rateLimitCheck = await checkRateLimit(
      supabase,
      keyData.id,
      keyData.rate_limit_per_minute,
      keyData.rate_limit_per_day
    );

    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({ error: rateLimitCheck.message }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get counts for webhook warnings
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const { count: minuteCount } = await supabase
      .from('sandbox_api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', keyData.id)
      .gte('created_at', oneMinuteAgo.toISOString());

    const { count: dailyCount } = await supabase
      .from('sandbox_api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', keyData.id)
      .gte('created_at', oneDayAgo.toISOString());

    // Check if approaching rate limit (80%) and trigger webhook
    if (minuteCount && minuteCount >= keyData.rate_limit_per_minute * 0.8 && minuteCount < keyData.rate_limit_per_minute) {
      // Trigger rate limit warning webhook
      fetch(`${supabaseUrl}/functions/v1/sandbox-trigger-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          api_key_id: keyData.id,
          event_type: 'rate_limit_warning',
          payload: {
            api_key_id: keyData.id,
            timestamp: new Date().toISOString(),
            limit_type: 'per_minute',
            current_usage: minuteCount,
            limit: keyData.rate_limit_per_minute,
            percentage: ((minuteCount / keyData.rate_limit_per_minute) * 100).toFixed(1),
          }
        })
      }).catch(err => console.error('Failed to trigger webhook:', err));
    }

    if (dailyCount && dailyCount >= keyData.rate_limit_per_day * 0.8 && dailyCount < keyData.rate_limit_per_day) {
      // Trigger rate limit warning webhook
      fetch(`${supabaseUrl}/functions/v1/sandbox-trigger-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          api_key_id: keyData.id,
          event_type: 'rate_limit_warning',
          payload: {
            api_key_id: keyData.id,
            timestamp: new Date().toISOString(),
            limit_type: 'per_day',
            current_usage: dailyCount,
            limit: keyData.rate_limit_per_day,
            percentage: ((dailyCount / keyData.rate_limit_per_day) * 100).toFixed(1),
          }
        })
      }).catch(err => console.error('Failed to trigger webhook:', err));
    }

    // Update last used timestamp
    await supabase
      .from('sandbox_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    // Log API usage
    const requestStartTime = Date.now();
    const { endpoint, method, status_code, response_time_ms } = await req.json();
    
    await supabase
      .from('sandbox_api_usage')
      .insert([{
        api_key_id: keyData.id,
        endpoint: endpoint || req.url,
        method: method || req.method,
        status_code: status_code || 200,
        response_time_ms: response_time_ms || (Date.now() - requestStartTime),
      }]);

    return new Response(JSON.stringify({ 
      valid: true,
      account: {
        company_name: keyData.sandbox_account.company_name,
        tier: keyData.sandbox_account.tier,
      },
      rate_limits: {
        per_minute: keyData.rate_limit_per_minute,
        per_day: keyData.rate_limit_per_day,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error validating sandbox API key:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to validate API key',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});