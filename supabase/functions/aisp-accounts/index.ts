import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getRateLimitInfo, checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '../_shared/security.ts';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization and consent headers
    const authHeader = req.headers.get('authorization');
    const consentId = req.headers.get('x-consent-id');

    // Get client_id from consent for rate limiting
    const { data: consentData } = await supabase
      .from('aisp_consents')
      .select('client_id')
      .eq('consent_id', consentId)
      .single();

    const clientId = consentData?.client_id || 'unknown';
    
    // Rate limiting - 300 requests per hour per client
    const rateLimit = await getRateLimitInfo(supabase, clientId, '/aisp/accounts', 300, 60);
    const allowed = await checkRateLimit(supabase, clientId, '/aisp/accounts', 300, 60);
    if (!allowed) {
      return rateLimitResponse(addRateLimitHeaders(corsHeaders, 300, rateLimit.remaining, rateLimit.reset));
    }

    if (!authHeader || !consentId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required headers: authorization and x-consent-id' 
        }),
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

    // Verify consent and check permission
    const { data: hasPermission, error: permError } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId,
      _user_id: user.id,
      _permission: 'ReadAccountsBasic'
    });

    if (permError || !hasPermission) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_consent',
          error_description: 'Consent not found, expired, or lacks ReadAccountsBasic permission'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get consent to check account_ids filter
    const { data: consent } = await supabase
      .from('aisp_consents')
      .select('account_ids')
      .eq('consent_id', consentId)
      .single();

    // Build accounts query
    let query = supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Filter by account_ids if specified in consent
    if (consent?.account_ids && Array.isArray(consent.account_ids)) {
      query = query.in('account_id', consent.account_ids);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve accounts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log access event
    await supabase.rpc('log_consent_event', {
      _consent_id: consentId,
      _consent_type: 'aisp',
      _event_type: 'accessed',
      _user_id: user.id,
      _metadata: { endpoint: 'accounts', count: accounts?.length || 0 }
    });

    // Format response in UK Open Banking format
    const response = {
      Data: {
        Account: accounts?.map(account => ({
          AccountId: account.account_id,
          Currency: account.currency,
          AccountType: account.account_type,
          AccountSubType: account.account_subtype,
          Nickname: account.nickname,
          Account: [
            {
              SchemeName: account.identification_scheme,
              Identification: account.identification_value,
              SecondaryIdentification: account.secondary_identification,
              Name: account.account_holder_name
            }
          ],
          OpeningDate: account.opened_date
        })) || []
      },
      Links: {
        Self: 'https://api.kangopenbanking.com/v1/aisp-accounts'
      },
      Meta: {
        TotalPages: 1
      }
    };

    const responseHeaders = addRateLimitHeaders(
      { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      300,
      rateLimit.remaining,
      rateLimit.reset
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Unexpected error in aisp-accounts:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
