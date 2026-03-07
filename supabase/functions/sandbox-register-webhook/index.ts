import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { webhook_url, event_types } = await req.json();

    if (!webhook_url || !event_types || !Array.isArray(event_types)) {
      return new Response(JSON.stringify({ error: 'webhook_url and event_types are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's sandbox account
    const { data: account, error: accountError } = await supabase
      .from('developer_sandbox_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Sandbox account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a secret key for webhook validation
    const secretKey = crypto.randomUUID();

    // Create webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('sandbox_webhooks')
      .insert([{
        sandbox_account_id: account.id,
        webhook_url,
        event_types,
        secret_key: secretKey,
      }])
      .select()
      .single();

    if (webhookError) {
      throw webhookError;
    }

    return new Response(JSON.stringify({ 
      webhook,
      message: 'Webhook registered successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to register webhook',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});