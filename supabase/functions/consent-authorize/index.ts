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
    const { consent_id, consent_type, authorized = true, selected_accounts = null } = body;

    if (!consent_id || !consent_type) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_request',
          error_description: 'Missing required fields: consent_id and consent_type'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine table based on consent type
    const table = consent_type === 'aisp' ? 'aisp_consents' : 'pisp_consents';

    // Get the consent
    const { data: consent, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('consent_id', consent_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !consent) {
      return new Response(
        JSON.stringify({ 
          error: 'not_found',
          error_description: 'Consent not found or does not belong to user'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if consent is in awaiting state
    if (consent.status !== 'AwaitingAuthorisation') {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_consent',
          error_description: `Consent is in ${consent.status} state and cannot be modified`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update consent status
    const newStatus = authorized ? 'Authorised' : 'Rejected';
    const updateData: any = {
      status: newStatus,
      authorized_at: authorized ? new Date().toISOString() : null
    };

    // If AISP consent and accounts selected, update account_ids
    if (consent_type === 'aisp' && authorized && selected_accounts) {
      updateData.account_ids = selected_accounts;
    }

    const { data: updatedConsent, error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq('consent_id', consent_id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update consent:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'server_error',
          error_description: 'Failed to update consent'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log authorization event
    await supabase.rpc('log_consent_event', {
      _consent_id: consent_id,
      _consent_type: consent_type,
      _event_type: authorized ? 'authorized' : 'rejected',
      _user_id: user.id,
      _client_id: consent.client_id,
      _metadata: authorized ? { selected_accounts } : { reason: 'user_rejected' }
    });

    console.log(`Consent ${consent_id} ${authorized ? 'authorized' : 'rejected'} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        Data: {
          ConsentId: updatedConsent.consent_id,
          Status: updatedConsent.status,
          StatusUpdateDateTime: updatedConsent.updated_at,
          AuthorizedAt: updatedConsent.authorized_at
        }
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('Unexpected error in consent-authorize:', error);
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        error_description: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
