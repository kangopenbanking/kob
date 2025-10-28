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

    const { product_id, account_name, opening_deposit, target_amount, target_date, auto_save_settings } = await req.json();

    console.log('Creating savings account for user:', user.id);

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('savings_products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      throw new Error('Invalid savings product');
    }

    // Validate opening deposit
    if (opening_deposit < product.min_opening_balance) {
      throw new Error(`Minimum opening balance is ${product.min_opening_balance} XAF`);
    }

    // Create main account entry
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        account_type: 'Personal',
        account_subtype: 'Savings',
        account_holder_name: user.email,
        nickname: account_name,
        identification_scheme: 'LOCAL_BANK',
        identification_value: `SAV-${Date.now()}`,
        account_id: `SAV-${Date.now()}`,
        currency: 'XAF',
        is_active: true,
      })
      .select()
      .single();

    if (accountError || !accountData) {
      throw new Error('Failed to create account');
    }

    // Calculate maturity date for fixed deposits
    let maturityDate = null;
    let isLocked = false;
    if (product.lock_in_period_months) {
      maturityDate = new Date();
      maturityDate.setMonth(maturityDate.getMonth() + product.lock_in_period_months);
      isLocked = true;
    }

    // Calculate next interest date
    const nextInterestDate = new Date();
    if (product.interest_payment_frequency === 'monthly') {
      nextInterestDate.setMonth(nextInterestDate.getMonth() + 1);
    } else if (product.interest_payment_frequency === 'quarterly') {
      nextInterestDate.setMonth(nextInterestDate.getMonth() + 3);
    } else if (product.interest_payment_frequency === 'annually') {
      nextInterestDate.setFullYear(nextInterestDate.getFullYear() + 1);
    } else {
      nextInterestDate.setTime(maturityDate?.getTime() || Date.now());
    }

    // Create savings account
    const { data: savingsAccount, error: savingsError } = await supabase
      .from('savings_accounts')
      .insert({
        account_id: accountData.id,
        user_id: user.id,
        product_id: product.id,
        savings_type: product.savings_type,
        account_name: account_name,
        target_amount: target_amount,
        target_date: target_date,
        auto_save_enabled: auto_save_settings?.enabled || false,
        auto_save_amount: auto_save_settings?.amount || null,
        auto_save_frequency: auto_save_settings?.frequency || null,
        auto_save_day: auto_save_settings?.day || null,
        current_balance: opening_deposit,
        available_balance: isLocked ? 0 : opening_deposit,
        current_interest_rate: product.base_interest_rate,
        next_interest_date: nextInterestDate.toISOString().split('T')[0],
        maturity_date: maturityDate?.toISOString().split('T')[0],
        is_locked: isLocked,
        status: 'active',
      })
      .select()
      .single();

    if (savingsError || !savingsAccount) {
      // Rollback account creation
      await supabase.from('accounts').delete().eq('id', accountData.id);
      throw new Error('Failed to create savings account');
    }

    // Record opening deposit transaction
    await supabase.from('savings_transactions').insert({
      savings_account_id: savingsAccount.id,
      user_id: user.id,
      transaction_type: 'deposit',
      amount: opening_deposit,
      balance_after: opening_deposit,
      description: 'Opening deposit',
      reference: `OPEN-${Date.now()}`,
    });

    // Create account balance record
    await supabase.from('account_balances').insert({
      account_id: accountData.id,
      balance_type: 'InterimAvailable',
      credit_debit_indicator: 'Credit',
      amount: opening_deposit,
      currency: 'XAF',
      balance_datetime: new Date().toISOString(),
    });

    console.log('Savings account created successfully:', savingsAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        savings_account: savingsAccount,
        account: accountData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating savings account:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});