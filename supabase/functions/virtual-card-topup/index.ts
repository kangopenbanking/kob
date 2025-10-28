import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    const { 
      virtual_card_id, 
      source_account_id, 
      amount_source_currency,
      source_currency 
    } = await req.json();

    console.log('Top-up request:', { virtual_card_id, source_account_id, amount_source_currency, source_currency });

    if (!virtual_card_id || !source_account_id || !amount_source_currency || !source_currency) {
      throw new Error('Missing required fields');
    }

    // Validate virtual card
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('*')
      .eq('id', virtual_card_id)
      .eq('user_id', user.id)
      .single();

    if (!card) {
      throw new Error('Virtual card not found');
    }

    if (card.status !== 'active') {
      throw new Error('Card is not active');
    }

    // Validate source account and balance
    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', source_account_id)
      .eq('user_id', user.id)
      .single();

    if (!account) {
      throw new Error('Source account not found');
    }

    const { data: balance } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', source_account_id)
      .eq('balance_type', 'InterimAvailable')
      .single();

    if (!balance || parseFloat(balance.amount) < amount_source_currency) {
      throw new Error('Insufficient balance in source account');
    }

    // Get exchange rate
    const { data: cachedRate } = await supabase
      .from('exchange_rates_cache')
      .select('*')
      .eq('base_currency', source_currency)
      .eq('target_currency', 'USD')
      .eq('rate_source', 'frankfurter')
      .gt('valid_until', new Date().toISOString())
      .single();

    let exchangeRate: number;
    let rateSource = 'frankfurter';

    if (cachedRate) {
      exchangeRate = parseFloat(cachedRate.rate);
      console.log('Using cached exchange rate:', exchangeRate);
    } else {
      // Fetch from Frankfurter API
      console.log('Fetching exchange rate from Frankfurter API...');
      const rateResponse = await fetch(
        `https://api.frankfurter.app/latest?from=${source_currency}&to=USD`
      );

      if (!rateResponse.ok) {
        throw new Error('Failed to fetch exchange rate');
      }

      const rateData = await rateResponse.json();
      exchangeRate = rateData.rates.USD;

      // Cache the rate for 1 hour
      await supabase
        .from('exchange_rates_cache')
        .upsert({
          base_currency: source_currency,
          target_currency: 'USD',
          rate: exchangeRate,
          rate_source: 'frankfurter',
          valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });

      console.log('Exchange rate fetched and cached:', exchangeRate);
    }

    // Calculate USD amount with conversion fee (1.5%)
    const conversionFeePercentage = 1.5;
    const usdBeforeFee = amount_source_currency * exchangeRate;
    const conversionFee = usdBeforeFee * (conversionFeePercentage / 100);
    const amountUsd = usdBeforeFee - conversionFee;

    console.log('Conversion:', {
      source: amount_source_currency,
      rate: exchangeRate,
      usdBeforeFee,
      conversionFee,
      amountUsd
    });

    // Generate transaction reference
    const transactionRef = `TOPUP-${crypto.randomUUID()}`;

    // Create funding transaction
    const { data: fundingTx, error: fundingError } = await supabase
      .from('card_funding_transactions')
      .insert({
        user_id: user.id,
        virtual_card_id: virtual_card_id,
        source_account_id: source_account_id,
        transaction_ref: transactionRef,
        amount_source_currency: amount_source_currency,
        source_currency: source_currency,
        amount_usd: amountUsd,
        exchange_rate: exchangeRate,
        exchange_rate_source: rateSource,
        conversion_fee: conversionFee,
        status: 'processing',
      })
      .select()
      .single();

    if (fundingError) {
      console.error('Failed to create funding transaction:', fundingError);
      throw new Error('Failed to create funding transaction');
    }

    // Debit source account
    const { error: debitError } = await supabase
      .from('account_balances')
      .update({
        amount: parseFloat(balance.amount) - amount_source_currency
      })
      .eq('id', balance.id);

    if (debitError) {
      console.error('Failed to debit source account:', debitError);
      // Rollback funding transaction
      await supabase
        .from('card_funding_transactions')
        .update({ status: 'failed', error_message: 'Failed to debit source account' })
        .eq('id', fundingTx.id);
      throw new Error('Failed to debit source account');
    }

    // Update virtual card balance
    const { error: cardUpdateError } = await supabase
      .from('virtual_cards')
      .update({
        balance_usd: parseFloat(card.balance_usd) + amountUsd
      })
      .eq('id', virtual_card_id);

    if (cardUpdateError) {
      console.error('Failed to update card balance:', cardUpdateError);
      // Note: In production, implement proper rollback/compensation
      await supabase
        .from('card_funding_transactions')
        .update({ status: 'failed', error_message: 'Failed to update card balance' })
        .eq('id', fundingTx.id);
      throw new Error('Failed to update card balance');
    }

    // Mark funding as completed
    await supabase
      .from('card_funding_transactions')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', fundingTx.id);

    console.log('Top-up completed successfully');

    return new Response(
      JSON.stringify({
        transaction: fundingTx,
        new_balance_usd: parseFloat(card.balance_usd) + amountUsd,
        conversion_details: {
          amount_source: amount_source_currency,
          source_currency: source_currency,
          exchange_rate: exchangeRate,
          usd_before_fee: usdBeforeFee,
          conversion_fee: conversionFee,
          conversion_fee_percentage: conversionFeePercentage,
          final_usd: amountUsd
        },
        message: 'Card topped up successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in virtual-card-topup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'VIRTUAL_CARD_TOPUP_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
