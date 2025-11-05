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
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
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

    const { amount, phone_number, provider, description, email, currency = 'XAF' } = await req.json();

    // Validate required fields
    if (!amount || !phone_number || !provider) {
      throw new Error('Missing required fields: amount, phone_number, provider');
    }

    // Validate currency
    const supportedCurrencies = ['XAF', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'RWF'];
    if (!supportedCurrencies.includes(currency.toUpperCase())) {
      throw new Error(`Currency ${currency} not supported for mobile money`);
    }

    // Validate provider
    if (!['mtn', 'orange'].includes(provider.toLowerCase())) {
      throw new Error('Invalid provider. Must be mtn or orange');
    }

    // Generate unique transaction reference using cryptographically secure random
    const transaction_ref = `MMC_${crypto.randomUUID()}`;

    console.log('Initiating mobile money charge:', {
      amount,
      phone_number,
      provider,
      transaction_ref
    });

    // Create transaction record
    const { data: transactionData, error: dbError } = await supabase
      .from('mobile_money_transactions')
      .insert({
        user_id: user.id,
        transaction_ref,
        transaction_type: 'charge',
        provider: provider.toLowerCase(),
        amount,
        currency: currency.toUpperCase(),
        phone_number,
        description: description || 'Mobile money charge',
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to create transaction record');
    }

    // Initiate Flutterwave mobile money charge
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_franco', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: transaction_ref,
        amount: amount.toString(),
        currency: currency.toUpperCase(),
        email: email || user.email,
        phone_number: phone_number,
        fullname: user.user_metadata?.full_name || 'Customer',
        redirect_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mobile-money-verify`,
      }),
    });

    const flutterwaveData = await flutterwaveResponse.json();
    console.log('Flutterwave response:', flutterwaveData);

    if (flutterwaveData.status === 'success') {
      // Update transaction with Flutterwave reference
      await supabase
        .from('mobile_money_transactions')
        .update({
          flutterwave_ref: flutterwaveData.data.flw_ref,
          status: 'processing',
          metadata: flutterwaveData.data
        })
        .eq('id', transactionData.id);

      // Record transaction fee
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('institution_id')
          .eq('id', user.id)
          .single();

        if (profile?.institution_id) {
          await supabase.rpc('record_transaction_fee', {
            _institution_id: profile.institution_id,
            _transaction_type: 'mobile_money_charge',
            _transaction_ref: transaction_ref,
            _transaction_amount: parseFloat(amount),
            _transaction_id: transactionData.id,
            _metadata: {
              provider,
              phone_number,
              flutterwave_ref: flutterwaveData.data.flw_ref
            }
          });
          console.log('Transaction fee recorded successfully');
        }
      } catch (feeError) {
        console.error('Error recording transaction fee:', feeError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: transactionData.id,
            transaction_ref,
            flutterwave_ref: flutterwaveData.data.flw_ref,
            status: 'processing',
            payment_link: flutterwaveData.data.link,
            message: 'Please complete payment on your mobile device'
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      // Update transaction as failed
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'failed',
          error_message: flutterwaveData.message || 'Payment initiation failed'
        })
        .eq('id', transactionData.id);

      throw new Error(flutterwaveData.message || 'Payment initiation failed');
    }

  } catch (error) {
    // Log full details server-side for debugging
    console.error('[MOBILE-MONEY] Error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      operation: 'mobile_money_charge',
      timestamp: new Date().toISOString()
    });
    
    // Return generic error - do not expose internal details
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'Transaction processing failed. Please try again.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
