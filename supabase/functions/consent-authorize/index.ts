import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken } from '../_shared/security.ts';

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

    const contentType = req.headers.get('content-type') || '';
    
    // Handle form submission from oauth-authorize (PKCE flow)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const session_id = formData.get('session_id') as string;
      const csrf_token = formData.get('csrf_token') as string;
      const action = formData.get('action') as string;

      if (!session_id || !csrf_token || !action) {
        return new Response('Missing required parameters', { status: 400 });
      }

      // Retrieve and validate OAuth session
      const { data: session, error: sessionError } = await supabase
        .from('oauth_sessions')
        .select('*')
        .eq('session_id', session_id)
        .eq('csrf_token', csrf_token)
        .single();

      if (sessionError || !session) {
        return new Response('Invalid or expired session', { status: 400 });
      }

      // Check session expiration
      if (new Date(session.expires_at) < new Date()) {
        return new Response('Session expired', { status: 400 });
      }

      // Handle user decision
      if (action === 'approve') {
        // Generate secure authorization code
        const authCode = generateSecureToken();
        const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store authorization code with PKCE challenge
        await supabase
          .from('authorization_codes')
          .insert({
            code: authCode,
            client_id: session.client_id,
            redirect_uri: session.redirect_uri,
            scope: session.scope,
            consent_id: session.consent_id,
            code_challenge: session.code_challenge,
            code_challenge_method: session.code_challenge_method,
            expires_at: codeExpiresAt.toISOString(),
            used: false,
          });

        // Delete used session
        await supabase
          .from('oauth_sessions')
          .delete()
          .eq('session_id', session_id);

        // Redirect with authorization code
        const redirectUrl = new URL(session.redirect_uri);
        redirectUrl.searchParams.set('code', authCode);
        if (session.state) {
          redirectUrl.searchParams.set('state', session.state);
        }

        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl.toString() }
        });
      } else {
        // User denied
        await supabase
          .from('oauth_sessions')
          .delete()
          .eq('session_id', session_id);

        const redirectUrl = new URL(session.redirect_uri);
        redirectUrl.searchParams.set('error', 'access_denied');
        if (session.state) {
          redirectUrl.searchParams.set('state', session.state);
        }

        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl.toString() }
        });
      }
    }

    // Handle API-based consent authorization (existing flow)
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

    // Log authorization event with validated metadata
    const validatedMetadata = authorized 
      ? { 
          action: 'authorized',
          account_count: Array.isArray(selected_accounts) ? selected_accounts.length : 0,
          timestamp: new Date().toISOString()
        }
      : { 
          action: 'rejected',
          reason: 'user_rejected',
          timestamp: new Date().toISOString()
        };

    await supabase.rpc('log_consent_event', {
      _consent_id: consent_id,
      _consent_type: consent_type,
      _event_type: authorized ? 'authorized' : 'rejected',
      _user_id: user.id,
      _client_id: consent.client_id,
      _metadata: validatedMetadata
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
