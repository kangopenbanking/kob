import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { extractFapiHeaders, addFapiResponseHeaders, logFapiContext } from "../_shared/fapi-headers.ts";
import { rejectJweContentType } from "../_shared/jws-signing.ts";
import { buildPaginationLinks } from "../_shared/ob-errors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jweCheck = rejectJweContentType(req, corsHeaders);
  if (jweCheck) return jweCheck;

  const fapi = extractFapiHeaders(req);
  logFapiContext(fapi, 'aisp-transactions');

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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2];

    const fromDate = url.searchParams.get('fromBookingDateTime');
    const toDate = url.searchParams.get('toBookingDateTime');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing account ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('authorization');
    const consentId = req.headers.get('x-consent-id');

    if (!authHeader || !consentId) {
      return new Response(JSON.stringify({ error: 'Missing required headers' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: hasBasic } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId, _user_id: user.id, _permission: 'ReadTransactionsBasic'
    });
    const { data: hasDetail } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId, _user_id: user.id, _permission: 'ReadTransactionsDetail'
    });

    if (!hasBasic && !hasDetail) {
      return new Response(JSON.stringify({ error: 'invalid_consent', error_description: 'Consent lacks transactions permission' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: consent } = await supabase
      .from('aisp_consents')
      .select('transaction_from_date, transaction_to_date')
      .eq('consent_id', consentId)
      .single();

    // ─── Try core account ───
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    let transactions: any[] = [];
    let totalCount = 0;
    let dataFreshness = 'realtime';

    if (account) {
      let countQuery = supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('account_id', account.id);
      let query = supabase.from('transactions').select('*').eq('account_id', account.id);

      if (consent?.transaction_from_date) {
        query = query.gte('booking_datetime', consent.transaction_from_date);
        countQuery = countQuery.gte('booking_datetime', consent.transaction_from_date);
      }
      if (consent?.transaction_to_date) {
        query = query.lte('booking_datetime', consent.transaction_to_date);
        countQuery = countQuery.lte('booking_datetime', consent.transaction_to_date);
      }
      if (fromDate) { query = query.gte('booking_datetime', fromDate); countQuery = countQuery.gte('booking_datetime', fromDate); }
      if (toDate) { query = query.lte('booking_datetime', toDate); countQuery = countQuery.lte('booking_datetime', toDate); }

      const { count } = await countQuery;
      totalCount = count || 0;

      const { data: txData, error: txError } = await query
        .order('booking_datetime', { ascending: false })
        .range(offset, offset + limit - 1);

      if (txError) {
        return new Response(JSON.stringify({ error: 'Failed to retrieve transactions' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      transactions = (txData || []).map(tx => {
        const base: any = {
          AccountId: accountId,
          TransactionId: tx.id,
          CreditDebitIndicator: tx.credit_debit_indicator || 'Debit',
          Status: tx.status,
          BookingDateTime: tx.booking_datetime || tx.created_at,
          ValueDateTime: tx.value_datetime,
          Amount: { Amount: tx.amount?.toString() || '0.00', Currency: tx.currency || 'XAF' },
          TransactionInformation: tx.transaction_information || tx.metadata?.description
        };
        if (hasDetail) {
          if (tx.merchant_details) base.MerchantDetails = tx.merchant_details;
          if (tx.creditor_account) base.CreditorAccount = tx.creditor_account;
          if (tx.debtor_account) base.DebtorAccount = tx.debtor_account;
          if (tx.balance_after) base.Balance = tx.balance_after;
        }
        return base;
      });
    } else {
      // ─── Try bank-sourced account ───
      const { data: psuLinks } = await supabase
        .from('bank_psu_links')
        .select('bank_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (psuLinks && psuLinks.length > 0) {
        const bankIds = psuLinks.map(l => l.bank_id);
        const { data: bsAccount } = await supabase
          .from('bank_sourced_accounts')
          .select('id')
          .eq('external_account_id', accountId)
          .in('bank_id', bankIds)
          .maybeSingle();

        if (bsAccount) {
          dataFreshness = 'daily_import';
          let bsQuery = supabase.from('bank_sourced_transactions').select('*').eq('account_id', bsAccount.id);
          let bsCountQuery = supabase.from('bank_sourced_transactions').select('id', { count: 'exact', head: true }).eq('account_id', bsAccount.id);

          if (fromDate) { bsQuery = bsQuery.gte('booking_date', fromDate); bsCountQuery = bsCountQuery.gte('booking_date', fromDate); }
          if (toDate) { bsQuery = bsQuery.lte('booking_date', toDate); bsCountQuery = bsCountQuery.lte('booking_date', toDate); }

          const { count } = await bsCountQuery;
          totalCount = count || 0;

          const { data: bsTxData } = await bsQuery.order('booking_date', { ascending: false }).range(offset, offset + limit - 1);

          transactions = (bsTxData || []).map(tx => ({
            AccountId: accountId,
            TransactionId: tx.id,
            CreditDebitIndicator: tx.credit_debit || 'Debit',
            Status: 'Booked',
            BookingDateTime: tx.booking_date,
            ValueDateTime: tx.value_date,
            Amount: { Amount: tx.amount?.toString() || '0.00', Currency: tx.currency || 'XAF' },
            TransactionInformation: tx.description || tx.reference,
            DataFreshness: 'daily_import'
          }));
        }
      }
    }

    if (transactions.length === 0 && !account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const response = {
      Data: { Transaction: transactions },
      Links: { Self: `https://api.kangopenbanking.com/v1/aisp-accounts/${accountId}/transactions?limit=${limit}&offset=${offset}` },
      Meta: {
        TotalPages: Math.ceil(totalCount / limit),
        TotalCount: totalCount,
        Limit: limit, Offset: offset,
        DataFreshness: dataFreshness
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Unexpected error in aisp-transactions:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
