import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to validate the token
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract token and validate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      client_name,
      institution_id,
      redirect_uris,
      scopes,
      grant_types
    } = await req.json();

    // Validate required fields
    if (!client_name || !institution_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_name, institution_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this institution
    const { data: institution, error: instError } = await adminSupabase
      .from('institutions')
      .select('id, user_id, institution_name')
      .eq('id', institution_id)
      .single();

    if (instError || !institution) {
      return new Response(
        JSON.stringify({ error: 'Institution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (institution.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to create clients for this institution' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate client credentials
    const client_id = `inst_${crypto.randomUUID()}`;
    const client_secret = generateSecureToken();
    const client_secret_hash = await hashSecret(client_secret);

    // Create API client
    const { data: client, error } = await adminSupabase
      .from('api_clients')
      .insert({
        client_id,
        client_secret_hash,
        client_name,
        institution_id,
        redirect_uris: redirect_uris || [],
        scopes: scopes || ['accounts', 'transactions', 'payments'],
        grant_types: grant_types || ['authorization_code', 'client_credentials'],
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
      action_type: 'institution_client_created',
      performed_by: user.id,
      details: {
        client_id,
        client_name,
        institution_id,
        institution_name: institution.institution_name
      }
    });

    console.log(`Institution API client created: ${client_id} for institution ${institution.institution_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        client_id,
        client_secret,
        client_name,
        created_at: client.created_at,
        message: 'API client created successfully. Store your client_secret securely - it will not be shown again.'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in institution-create-client:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
