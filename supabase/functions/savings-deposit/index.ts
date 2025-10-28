import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { savings_account_id, amount, source_account_id } = await req.json();

    console.log('Processing savings deposit:', { savings_account_id, amount });

    // Get savings account
    const { data: savingsAccount, error: accountError } = await supabase
      .from('savings_accounts')
      .select('*, savings_products(*)')
      .eq('id', savings_account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !savingsAccount) {
      throw new Error('Savings account not found');
    }

    if (savingsAccount.status !== 'active') {
      throw new Error('Savings account is not active');
    }

    // Check if account is locked (fixed deposit)
    if (savingsAccount.is_locked) {
      throw new Error('Cannot deposit to locked fixed deposit account');
    }

    // Validate source account has sufficient balance (if provided)
    if (source_account_id) {
      const { data: sourceBalance } = await supabase
        .from('account_balances')
        .select('amount')
        .eq('account_id', source_account_id)
        .eq('balance_type', 'InterimAvailable')
        .single();

      if (!sourceBalance || parseFloat(sourceBalance.amount) < amount) {
        throw new Error('Insufficient balance in source account');
      }
    }

    // Update savings account balance
    const newBalance = parseFloat(savingsAccount.current_balance) + amount;
    const { error: updateError } = await supabase
      .from('savings_accounts')
      .update({
        current_balance: newBalance,
        available_balance: newBalance,
      })
      .eq('id', savings_account_id);

    if (updateError) {
      throw new Error('Failed to update savings balance');
    }

    // Record transaction
    await supabase.from('savings_transactions').insert({
      savings_account_id: savings_account_id,
      user_id: user.id,
      transaction_type: 'deposit',
      amount: amount,
      balance_after: newBalance,
      source_account_id: source_account_id,
      description: 'Deposit to savings',
      reference: `DEP-${Date.now()}`,
    });

    // Update account balance record
    await supabase.from('account_balances').upsert({
      account_id: savingsAccount.account_id,
      balance_type: 'InterimAvailable',
      credit_debit_indicator: 'Credit',
      amount: newBalance,
      currency: 'XAF',
      balance_datetime: new Date().toISOString(),
    });

    // Check if goal reached
    let goalReached = false;
    if (savingsAccount.target_amount && newBalance >= parseFloat(savingsAccount.target_amount)) {
      goalReached = true;
    }

    console.log('Deposit successful. New balance:', newBalance);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        goal_reached: goalReached,
        transaction_ref: `DEP-${Date.now()}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing deposit:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});