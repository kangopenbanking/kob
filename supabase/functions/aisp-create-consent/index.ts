import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      client_id,
      permissions,
      account_ids = null,
      transaction_from_date = null,
      transaction_to_date = null,
      expiration_days = 90 // Default 90 days
    } = body;

    // Validate required fields
    if (!client_id || !permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'Missing required fields: client_id and permissions array'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify client exists and is active
    const { data: client, error: clientError } = await supabase
      .from('tpp_registrations')
      .select('client_id, client_name, software_roles')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_client',
          error_description: 'Client not found or inactive'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if client has AISP role
    if (!client.software_roles.includes('AISP')) {
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized_client',
          error_description: 'Client does not have AISP role'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique consent ID
    const consentId = `aac_${crypto.randomUUID()}`;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expiration_days);

    // Create AISP consent
    const { data: consent, error: consentError } = await supabase
      .from('aisp_consents')
      .insert({
        consent_id: consentId,
        client_id,
        user_id: user.id,
        permissions,
        account_ids,
        transaction_from_date,
        transaction_to_date,
        expiration_date: expirationDate.toISOString(),
        status: 'AwaitingAuthorisation'
      })
      .select()
      .single();

    if (consentError) {
      console.error('Failed to create AISP consent:', consentError);
      return new Response(
        JSON.stringify({ 
          error: 'server_error',
          error_description: 'Failed to create consent'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log consent creation event
    await supabase.rpc('log_consent_event', {
      _consent_id: consentId,
      _consent_type: 'aisp',
      _event_type: 'created',
      _user_id: user.id,
      _client_id: client_id,
      _metadata: { permissions, account_ids }
    });

    console.log(`AISP consent created: ${consentId} for user: ${user.id}`);

    // Return consent details
    const response = {
      Data: {
        ConsentId: consent.consent_id,
        Status: consent.status,
        CreationDateTime: consent.created_at,
        ExpirationDateTime: consent.expiration_date,
        Permissions: consent.permissions,
        TransactionFromDateTime: consent.transaction_from_date,
        TransactionToDateTime: consent.transaction_to_date
      },
      Risk: {},
      Links: {
        Self: `https://api.kangopenbanking.com/v1/aisp-consents/${consentId}`
      },
      Meta: {
        TotalPages: 1
      }
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Unexpected error in aisp-create-consent:', error);
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        error_description: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
