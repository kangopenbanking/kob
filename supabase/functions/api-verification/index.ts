import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { account_number, bank_code, account_holder_name } = await req.json();

    // Validate required fields
    if (!account_number) {
      return new Response(JSON.stringify({ error: 'Account number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search for account by identification value
    const { data: accounts, error: searchError } = await supabase
      .from('accounts')
      .select('id, account_id, account_holder_name, is_active, account_type, account_subtype, currency')
      .eq('identification_value', account_number);

    if (searchError) {
      console.error('Account search error:', searchError);
      return new Response(JSON.stringify({ error: 'Verification failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if account exists
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({
        verified: false,
        status: 'NOT_FOUND',
        message: 'Account not found'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const account = accounts[0];

    // Check if account is active
    if (!account.is_active) {
      return new Response(JSON.stringify({
        verified: false,
        status: 'INACTIVE',
        message: 'Account is inactive',
        account_holder_name: account.account_holder_name
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optionally verify account holder name if provided
    let nameMatch = true;
    if (account_holder_name) {
      nameMatch = account.account_holder_name.toLowerCase().includes(account_holder_name.toLowerCase()) ||
                  account_holder_name.toLowerCase().includes(account.account_holder_name.toLowerCase());
    }

    if (!nameMatch) {
      return new Response(JSON.stringify({
        verified: false,
        status: 'NAME_MISMATCH',
        message: 'Account holder name does not match',
        account_holder_name: account.account_holder_name
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Account verified successfully
    return new Response(JSON.stringify({
      verified: true,
      status: 'VERIFIED',
      message: 'Account verified successfully',
      account_holder_name: account.account_holder_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype,
      currency: account.currency
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Verification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
