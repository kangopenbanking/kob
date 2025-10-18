import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      client_name, 
      redirect_uris, 
      scopes, 
      grant_types,
      institution_id 
    } = await req.json();

    // Generate client credentials
    const client_id = `client_${crypto.randomUUID()}`;
    const client_secret = `secret_${crypto.randomUUID()}`;

    // Create API client
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: client, error } = await adminSupabase
      .from('api_clients')
      .insert({
        client_id,
        client_secret_hash: client_secret, // In production, hash this
        client_name,
        redirect_uris: redirect_uris || [],
        scopes: scopes || ['accounts', 'transactions'],
        grant_types: grant_types || ['authorization_code', 'refresh_token'],
        institution_id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the creation
    console.log(`API Client created: ${client_id} by ${user.email}`);

    return new Response(
      JSON.stringify({
        client_id,
        client_secret,
        client_name,
        redirect_uris,
        scopes,
        created_at: client.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-create-client:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
