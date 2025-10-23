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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const flutterwaveSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const {
      source_mobile_account_id,
      destination_account_id,
      amount,
      currency,
      description
    } = await req.json();

    // Validate required fields
    if (!source_mobile_account_id || !destination_account_id || !amount) {
      throw new Error('Missing required fields');
    }

    // Validate currency
    const supportedCurrencies = ['XAF', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'RWF'];
    const normalizedCurrency = (currency || 'XAF').toUpperCase();

    if (!supportedCurrencies.includes(normalizedCurrency)) {
      throw new Error(`Currency ${normalizedCurrency} not supported. Supported: ${supportedCurrencies.join(', ')}`);
    }

    // Verify user owns both accounts
    const { data: mobileAccount, error: mobileError } = await supabase
      .from('mobile_money_accounts')
      .select('*')
      .eq('id', source_mobile_account_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (mobileError || !mobileAccount) {
      throw new Error('Invalid mobile money account');
    }

    const { data: bankAccount, error: bankError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', destination_account_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (bankError || !bankAccount) {
      throw new Error('Invalid bank account');
    }

    // Generate unique transaction reference
    const transactionRef = `MMTB-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Log transfer initiation
    console.log('Initiating mobile-to-bank transfer:', {
      transactionRef,
      currency: normalizedCurrency,
      amount,
      provider: mobileAccount.provider,
      phone: mobileAccount.phone_number.substring(0, 6) + '***',
      destinationAccount: bankAccount.account_id
    });

    // Create pending mobile money transaction
    const { data: mobileTransaction, error: insertError } = await supabase
      .from('mobile_money_transactions')
      .insert({
        user_id: user.id,
        mobile_account_id: source_mobile_account_id,
        destination_account_id: destination_account_id,
        transaction_ref: transactionRef,
        transaction_type: 'bank_deposit',
        amount: amount,
        currency: normalizedCurrency,
        status: 'pending',
        provider: mobileAccount.provider,
        phone_number: mobileAccount.phone_number,
        is_bank_deposit: true,
        metadata: {
          description: description || 'Mobile Money to Bank Transfer',
          bank_account_id: bankAccount.account_id,
          bank_account_name: bankAccount.account_holder_name
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating transaction:', insertError);
      throw new Error('Failed to create transaction');
    }

    // Initiate Flutterwave mobile money charge
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_franco', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: transactionRef,
        amount: amount,
        currency: normalizedCurrency,
        email: user.email,
        phone_number: mobileAccount.phone_number,
        fullname: user.user_metadata?.full_name || 'User',
        redirect_url: `${supabaseUrl}/functions/v1/mobile-money-verify?transaction_ref=${transactionRef}`,
      }),
    });

    const flutterwaveData = await flutterwaveResponse.json();
    console.log('Flutterwave response:', flutterwaveData);

    if (flutterwaveData.status === 'success') {
      // Update transaction with Flutterwave reference
      await supabase
        .from('mobile_money_transactions')
        .update({
          flutterwave_ref: flutterwaveData.data.id || flutterwaveData.data.flw_ref,
          status: 'processing',
          metadata: {
            ...mobileTransaction.metadata,
            flutterwave_response: flutterwaveData.data
          }
        })
        .eq('id', mobileTransaction.id);

      return new Response(JSON.stringify({
        success: true,
        data: {
          mobile_transaction_id: mobileTransaction.id,
          transaction_ref: transactionRef,
          payment_link: flutterwaveData.data.link || flutterwaveData.meta?.authorization?.redirect,
          status: 'processing',
          message: 'Payment link generated. Complete payment to credit your bank account.'
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Update transaction as failed
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'failed',
          error_message: flutterwaveData.message || 'Failed to initiate payment',
        })
        .eq('id', mobileTransaction.id);

      throw new Error(flutterwaveData.message || 'Failed to initiate payment');
    }

  } catch (error: any) {
    console.error('Mobile money to bank error:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify({
      error: error.message,
      success: false,
      code: 'MOBILE_TO_BANK_ERROR',
      details: {
        supported_currencies: ['XAF', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'RWF']
      }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
