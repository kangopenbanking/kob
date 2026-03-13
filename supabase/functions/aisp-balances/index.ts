import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
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

    // Parse URL to get account ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2]; // ../accounts/{accountId}/balances

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Missing account ID in path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get headers
    const authHeader = req.headers.get('authorization');
    const consentId = req.headers.get('x-consent-id');

    if (!authHeader || !consentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required headers' }),
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

    // Check ReadBalances permission
    const { data: hasPermission } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId,
      _user_id: user.id,
      _permission: 'ReadBalances'
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_consent',
          error_description: 'Consent lacks ReadBalances permission'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify account belongs to user and is in consent scope
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Account not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get balances for the account
    const { data: balances, error: balancesError } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', account.id)
      .order('balance_datetime', { ascending: false })
      .limit(10);

    if (balancesError) {
      console.error('Error fetching balances:', balancesError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve balances' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const response = {
      Data: {
        Balance: balances?.map(balance => ({
          AccountId: accountId,
          CreditDebitIndicator: balance.credit_debit_indicator,
          Type: balance.balance_type,
          DateTime: balance.balance_datetime,
          Amount: {
            Amount: balance.amount.toString(),
            Currency: balance.currency
          },
          CreditLine: balance.credit_line
        })) || []
      },
      Links: {
        Self: `https://api.kangopenbanking.com/v1/aisp-accounts/${accountId}/balances`
      },
      Meta: {
        TotalPages: 1
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Unexpected error in aisp-balances:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
