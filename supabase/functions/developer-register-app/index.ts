import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      app_name,
      app_description,
      developer_company,
      developer_use_case,
      api_environment,
      rate_limit_tier
    } = await req.json();

    // Validate required fields
    if (!app_name || !developer_use_case || !api_environment) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: app_name, developer_use_case, api_environment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user email from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    // Generate client credentials
    const client_id = `dev_${crypto.randomUUID()}`;
    const client_secret = generateSecureToken();
    const client_secret_hash = await hashSecret(client_secret);

    // Determine rate limits based on tier
    const rateLimits = {
      'free': 1000,
      'starter': 10000,
      'professional': 100000,
      'enterprise': 1000000
    };

    const monthly_requests_limit = rateLimits[rate_limit_tier as keyof typeof rateLimits] || 1000;

    // Create API client using service role
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: client, error } = await adminSupabase
      .from('api_clients')
      .insert({
        client_id,
        client_secret_hash,
        client_name: app_name,
        developer_user_id: user.id,
        developer_email: profile?.email || user.email,
        developer_company: developer_company || null,
        developer_use_case: developer_use_case,
        api_environment: api_environment || 'sandbox',
        rate_limit_tier: rate_limit_tier || 'free',
        monthly_requests_limit,
        requests_used: 0,
        redirect_uris: [],
        scopes: ['accounts', 'transactions', 'payments'],
        grant_types: ['client_credentials'],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating API client:', error);
      throw error;
    }

    // Log the creation
    await adminSupabase.from('audit_logs').insert({
      entity_type: 'api_client',
      entity_id: client.id,
      action_type: 'developer_app_registered',
      performed_by: user.id,
      details: {
        client_id,
        app_name,
        api_environment,
        rate_limit_tier
      }
    });

    console.log(`Developer app registered: ${client_id} by ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        client_id,
        client_secret,
        app_name,
        api_environment,
        rate_limit_tier,
        monthly_requests_limit,
        created_at: client.created_at,
        message: 'API credentials created successfully. Store your client_secret securely - it will not be shown again.'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in developer-register-app:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
