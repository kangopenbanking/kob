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
    const { consent_id, consent_type, reason = 'User requested revocation' } = body;

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

    // Check if consent can be revoked
    if (consent.status === 'Revoked' || consent.status === 'Expired') {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_consent',
          error_description: `Consent is already ${consent.status}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revoke the consent
    const { data: revokedConsent, error: updateError } = await supabase
      .from(table)
      .update({
        status: 'Revoked',
        revoked_at: new Date().toISOString(),
        revocation_reason: reason
      })
      .eq('consent_id', consent_id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to revoke consent:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'server_error',
          error_description: 'Failed to revoke consent'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log revocation event
    await supabase.rpc('log_consent_event', {
      _consent_id: consent_id,
      _consent_type: consent_type,
      _event_type: 'revoked',
      _user_id: user.id,
      _client_id: consent.client_id,
      _metadata: { reason }
    });

    console.log(`Consent ${consent_id} revoked by user ${user.id}`);

    return new Response(
      JSON.stringify({
        Data: {
          ConsentId: revokedConsent.consent_id,
          Status: revokedConsent.status,
          RevokedAt: revokedConsent.revoked_at,
          RevocationReason: revokedConsent.revocation_reason
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
    console.error('Unexpected error in consent-revoke:', error);
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        error_description: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
