import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify user is admin
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      console.warn('admin-create-client unauthorized request', {
        reason: authError?.message || 'missing_user',
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasAdminRole, error: roleError } = await adminSupabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('admin-create-client role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify admin role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Generate client credentials using secure 256-bit tokens
    const client_id = `client_${crypto.randomUUID()}`;
    const client_secret = generateSecureToken();
    
    // Hash the client secret before storing
    const client_secret_hash = await hashSecret(client_secret);

    const { data: client, error } = await adminSupabase
      .from('api_clients')
      .insert({
        client_id,
        client_secret_hash,
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
