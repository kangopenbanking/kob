import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2];

    const authHeader = req.headers.get('authorization');
    const consentId = req.headers.get('x-consent-id');

    if (!authHeader || !consentId || !accountId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check ReadStandingOrdersBasic permission
    const { data: hasPermission } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId,
      _user_id: user.id,
      _permission: 'ReadStandingOrdersBasic'
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get standing orders
    const { data: standingOrders } = await supabase
      .from('standing_orders')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'Active');

    const response = {
      Data: {
        StandingOrder: standingOrders?.map(so => ({
          AccountId: accountId,
          StandingOrderId: so.standing_order_id,
          Frequency: so.frequency,
          Reference: so.reference,
          FirstPaymentDateTime: so.first_payment_date,
          NextPaymentDateTime: so.next_payment_date,
          FinalPaymentDateTime: so.final_payment_date,
          FirstPaymentAmount: {
            Amount: so.first_payment_amount.toString(),
            Currency: so.currency
          },
          NextPaymentAmount: so.next_payment_amount ? {
            Amount: so.next_payment_amount.toString(),
            Currency: so.currency
          } : undefined,
          CreditorAccount: {
            SchemeName: so.creditor_identification_scheme,
            Identification: so.creditor_identification_value,
            Name: so.creditor_name
          }
        })) || []
      },
      Links: {
        Self: `https://api.kangopenbanking.com/v1/aisp-accounts/${accountId}/standing-orders`
      },
      Meta: { TotalPages: 1 }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Error in aisp-standing-orders:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
