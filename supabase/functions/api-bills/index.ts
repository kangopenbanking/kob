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

    const {
      account_id,
      biller_name,
      biller_code,
      bill_reference,
      amount,
      currency,
      bill_type,
      description
    } = await req.json();

    // Validate required fields
    if (!account_id || !biller_name || !bill_reference || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Account not found or unauthorized' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check account balance
    const { data: balance } = await supabase
      .from('account_balances')
      .select('amount')
      .eq('account_id', account_id)
      .eq('balance_type', 'InterimAvailable')
      .single();

    if (!balance || parseFloat(balance.amount) < parseFloat(amount)) {
      return new Response(JSON.stringify({ error: 'Insufficient funds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate payment reference
    const paymentRef = `BILL${Date.now()}`;

    // Create transaction record for bill payment
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: account_id,
        transaction_id: paymentRef,
        credit_debit_indicator: 'Debit',
        status: 'Booked',
        booking_date: new Date().toISOString(),
        value_date: new Date().toISOString(),
        amount: amount,
        currency: currency || 'XAF',
        transaction_information: description || `Bill payment to ${biller_name}`,
        merchant_details: {
          biller_name,
          biller_code,
          bill_reference,
          bill_type: bill_type || 'utility'
        }
      })
      .select()
      .single();

    if (txnError) {
      console.error('Bill payment transaction error:', txnError);
      return new Response(JSON.stringify({ error: 'Failed to process bill payment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update account balance
    await supabase
      .from('account_balances')
      .update({
        amount: parseFloat(balance.amount) - parseFloat(amount),
        balance_datetime: new Date().toISOString()
      })
      .eq('account_id', account_id)
      .eq('balance_type', 'InterimAvailable');

    // Record transaction fee
    try {
      if (account.institution_id) {
        await supabase.rpc('record_transaction_fee', {
          _institution_id: account.institution_id,
          _transaction_type: 'bill_payment',
          _transaction_ref: paymentRef,
          _transaction_amount: parseFloat(amount),
          _transaction_id: transaction.id,
          _metadata: {
            biller_name,
            bill_reference,
            bill_type: bill_type || 'utility'
          }
        });
        console.log('Transaction fee recorded successfully');
      }
    } catch (feeError) {
      console.error('Error recording transaction fee:', feeError);
    }

    return new Response(JSON.stringify({
      success: true,
      payment_reference: paymentRef,
      transaction_id: transaction.id,
      status: 'Paid',
      biller_name,
      bill_reference,
      amount: amount,
      currency: currency || 'XAF',
      payment_date: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Bill payment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
