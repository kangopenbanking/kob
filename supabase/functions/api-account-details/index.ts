import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract account ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 1];

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Account ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch account balances
    const { data: balances, error: balanceError } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', accountId);

    if (balanceError) {
      console.error('Balance fetch error:', balanceError);
    }

    return new Response(JSON.stringify({
      account_id: account.account_id,
      account_holder_name: account.account_holder_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype,
      currency: account.currency,
      nickname: account.nickname,
      identification: {
        scheme: account.identification_scheme,
        value: account.identification_value
      },
      is_active: account.is_active,
      opened_date: account.opened_date,
      balances: balances || [],
      created_at: account.created_at,
      updated_at: account.updated_at
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Account details error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
