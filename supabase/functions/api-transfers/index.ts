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

    const { source_account_id, destination_account_id, amount, currency, reference, description } = await req.json();

    // Validate required fields
    if (!source_account_id || !destination_account_id || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify source account belongs to user
    const { data: sourceAccount, error: sourceError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', source_account_id)
      .eq('user_id', user.id)
      .single();

    if (sourceError || !sourceAccount) {
      return new Response(JSON.stringify({ error: 'Source account not found or unauthorized' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check source account balance
    const { data: balance } = await supabase
      .from('account_balances')
      .select('amount')
      .eq('account_id', source_account_id)
      .eq('balance_type', 'InterimAvailable')
      .single();

    if (!balance || parseFloat(balance.amount) < parseFloat(amount)) {
      return new Response(JSON.stringify({ error: 'Insufficient funds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify destination account exists
    const { data: destAccount, error: destError } = await supabase
      .from('accounts')
      .select('id, account_holder_name')
      .eq('id', destination_account_id)
      .single();

    if (destError || !destAccount) {
      return new Response(JSON.stringify({ error: 'Destination account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate transaction reference
    const transactionRef = reference || `TXN${Date.now()}`;

    // Create transaction record
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: source_account_id,
        transaction_id: transactionRef,
        credit_debit_indicator: 'Debit',
        status: 'Booked',
        booking_date: new Date().toISOString(),
        value_date: new Date().toISOString(),
        amount: amount,
        currency: currency || 'XAF',
        transaction_information: description || `Transfer to ${destAccount.account_holder_name}`,
        merchant_details: {
          destination_account_id,
          destination_account_holder: destAccount.account_holder_name
        }
      })
      .select()
      .single();

    if (txnError) {
      console.error('Transaction creation error:', txnError);
      return new Response(JSON.stringify({ error: 'Failed to create transaction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update source account balance
    await supabase
      .from('account_balances')
      .update({
        amount: parseFloat(balance.amount) - parseFloat(amount),
        balance_datetime: new Date().toISOString()
      })
      .eq('account_id', source_account_id)
      .eq('balance_type', 'InterimAvailable');

    return new Response(JSON.stringify({
      success: true,
      transaction_reference: transactionRef,
      transaction_id: transaction.id,
      status: 'Booked',
      amount: amount,
      currency: currency || 'XAF'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Transfer error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
