import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account ID from URL
    const url = new URL(req.url);
    const accountId = url.pathname.split('/').pop();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Account ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account details
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (error || !account) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest balance
    const { data: balance } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', accountId)
      .order('balance_datetime', { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        Data: {
          Account: {
            AccountId: account.account_id,
            Status: account.is_active ? 'Enabled' : 'Disabled',
            StatusUpdateDateTime: account.updated_at,
            Currency: account.currency,
            AccountType: account.account_type,
            AccountSubType: account.account_subtype,
            Nickname: account.nickname,
            OpeningDate: account.opened_date,
            Account: [{
              SchemeName: account.identification_scheme,
              Identification: account.identification_value,
              Name: account.account_holder_name,
              SecondaryIdentification: account.secondary_identification,
            }],
            Balance: balance ? {
              Amount: {
                Amount: balance.amount,
                Currency: balance.currency,
              },
              Type: balance.balance_type,
              CreditDebitIndicator: balance.credit_debit_indicator,
              DateTime: balance.balance_datetime,
            } : null,
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-account-detail:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
