import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      payment_type = 'domestic',
      instructed_amount,
      creditor,
      debtor_account = null,
      reference = '',
      remittance_information = '',
      risk = {},
      consent_expires_hours = 24 // Default 24 hours
    } = body;

    // Validate required fields
    if (!client_id || !instructed_amount || !creditor) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'Missing required fields: client_id, instructed_amount, creditor'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount structure
    if (!instructed_amount.amount || !instructed_amount.currency) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'instructed_amount must include amount and currency'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate currency is XAF
    if (instructed_amount.currency !== 'XAF') {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'Only XAF currency is supported'
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

    // Check if client has PISP role
    if (!client.software_roles.includes('PISP')) {
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized_client',
          error_description: 'Client does not have PISP role'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique consent ID
    const consentId = `pdpc_${crypto.randomUUID()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + consent_expires_hours);

    // Create PISP consent
    const { data: consent, error: consentError } = await supabase
      .from('pisp_consents')
      .insert({
        consent_id: consentId,
        client_id,
        user_id: user.id,
        payment_type,
        instructed_amount,
        creditor,
        debtor_account,
        reference,
        remittance_information,
        risk,
        expires_at: expiresAt.toISOString(),
        status: 'AwaitingAuthorisation'
      })
      .select()
      .single();

    if (consentError) {
      console.error('Failed to create PISP consent:', consentError);
      return new Response(
        JSON.stringify({ 
          error: 'server_error',
          error_description: 'Failed to create payment consent'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log consent creation event
    await supabase.rpc('log_consent_event', {
      _consent_id: consentId,
      _consent_type: 'pisp',
      _event_type: 'created',
      _user_id: user.id,
      _client_id: client_id,
      _metadata: { payment_type, amount: instructed_amount }
    });

    console.log(`PISP consent created: ${consentId} for user: ${user.id}`);

    // Return consent details (UK Open Banking format)
    const response = {
      Data: {
        ConsentId: consent.consent_id,
        Status: consent.status,
        CreationDateTime: consent.created_at,
        StatusUpdateDateTime: consent.updated_at,
        Initiation: {
          InstructedAmount: consent.instructed_amount,
          CreditorAccount: consent.creditor.account,
          DebtorAccount: consent.debtor_account,
          RemittanceInformation: {
            Reference: consent.reference,
            Unstructured: consent.remittance_information
          }
        }
      },
      Risk: consent.risk,
      Links: {
        Self: `${supabaseUrl}/functions/v1/pisp-consents/${consentId}`
      },
      Meta: {}
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
    console.error('Unexpected error in pisp-create-consent:', error);
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        error_description: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
