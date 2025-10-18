import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-consent-id',
};

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

    // Parse URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2];

    // Query parameters for date filtering
    const fromDate = url.searchParams.get('fromBookingDateTime');
    const toDate = url.searchParams.get('toBookingDateTime');

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Missing account ID' }),
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

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permission (ReadTransactionsBasic or ReadTransactionsDetail)
    const { data: hasBasic } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId,
      _user_id: user.id,
      _permission: 'ReadTransactionsBasic'
    });

    const { data: hasDetail } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId,
      _user_id: user.id,
      _permission: 'ReadTransactionsDetail'
    });

    if (!hasBasic && !hasDetail) {
      return new Response(
        JSON.stringify({ 
          error: 'invalid_consent',
          error_description: 'Consent lacks transactions permission'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get consent date range
    const { data: consent } = await supabase
      .from('aisp_consents')
      .select('transaction_from_date, transaction_to_date')
      .eq('consent_id', consentId)
      .single();

    // Verify account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build transaction query with date filters
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account.id);

    // Apply consent date range
    if (consent?.transaction_from_date) {
      query = query.gte('booking_datetime', consent.transaction_from_date);
    }
    if (consent?.transaction_to_date) {
      query = query.lte('booking_datetime', consent.transaction_to_date);
    }

    // Apply query parameters
    if (fromDate) {
      query = query.gte('booking_datetime', fromDate);
    }
    if (toDate) {
      query = query.lte('booking_datetime', toDate);
    }

    query = query.order('booking_datetime', { ascending: false }).limit(100);

    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const response = {
      Data: {
        Transaction: transactions?.map(tx => {
          const base: any = {
            AccountId: accountId,
            TransactionId: tx.id,
            CreditDebitIndicator: tx.credit_debit_indicator || 'Debit',
            Status: tx.status,
            BookingDateTime: tx.booking_datetime || tx.created_at,
            ValueDateTime: tx.value_datetime,
            Amount: {
              Amount: tx.amount?.toString() || '0.00',
              Currency: tx.currency || 'XAF'
            },
            TransactionInformation: tx.transaction_information || tx.metadata?.description
          };

          // Include detailed fields if permission granted
          if (hasDetail) {
            if (tx.merchant_details) {
              base.MerchantDetails = tx.merchant_details;
            }
            if (tx.creditor_account) {
              base.CreditorAccount = tx.creditor_account;
            }
            if (tx.debtor_account) {
              base.DebtorAccount = tx.debtor_account;
            }
            if (tx.balance_after) {
              base.Balance = tx.balance_after;
            }
          }

          return base;
        }) || []
      },
      Links: {
        Self: `${supabaseUrl}/functions/v1/aisp-accounts/${accountId}/transactions`
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
    console.error('Unexpected error in aisp-transactions:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
