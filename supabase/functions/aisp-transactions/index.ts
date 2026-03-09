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

    // Parse URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2];

    // Query parameters for date filtering and pagination
    const fromDate = url.searchParams.get('fromBookingDateTime');
    const toDate = url.searchParams.get('toBookingDateTime');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

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

    // Count query for total (same filters, no pagination)
    let countQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id);

    // Build transaction query with date filters
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account.id);

    // Apply consent date range to both queries
    if (consent?.transaction_from_date) {
      query = query.gte('booking_datetime', consent.transaction_from_date);
      countQuery = countQuery.gte('booking_datetime', consent.transaction_from_date);
    }
    if (consent?.transaction_to_date) {
      query = query.lte('booking_datetime', consent.transaction_to_date);
      countQuery = countQuery.lte('booking_datetime', consent.transaction_to_date);
    }

    // Apply query parameters to both queries
    if (fromDate) {
      query = query.gte('booking_datetime', fromDate);
      countQuery = countQuery.gte('booking_datetime', fromDate);
    }
    if (toDate) {
      query = query.lte('booking_datetime', toDate);
      countQuery = countQuery.lte('booking_datetime', toDate);
    }

    // Get total count
    const { count: totalCount } = await countQuery;

    // Apply pagination
    query = query
      .order('booking_datetime', { ascending: false })
      .range(offset, offset + limit - 1);

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
        Self: `https://api.kangopenbanking.com/v1/aisp-accounts/${accountId}/transactions?limit=${limit}&offset=${offset}`
      },
      Meta: {
        TotalPages: Math.ceil((totalCount || 0) / limit),
        TotalCount: totalCount || 0,
        Limit: limit,
        Offset: offset
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
