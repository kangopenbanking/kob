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

    const { amount, phone_number, provider, description, beneficiary_name } = await req.json();

    // Validate required fields
    if (!amount || !phone_number || !provider) {
      throw new Error('Missing required fields: amount, phone_number, provider');
    }

    // Validate provider
    if (!['mtn', 'orange'].includes(provider.toLowerCase())) {
      throw new Error('Invalid provider. Must be mtn or orange');
    }

    // Generate unique transaction reference
    const transaction_ref = `MMT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Initiating mobile money transfer:', {
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
        transaction_type: 'transfer',
        provider: provider.toLowerCase(),
        amount,
        currency: 'XAF',
        phone_number,
        description: description || 'Mobile money transfer',
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to create transaction record');
    }

    // Initiate Flutterwave transfer (payout)
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: provider.toLowerCase() === 'mtn' ? 'MPS' : 'ORANGE',
        account_number: phone_number,
        amount: amount,
        narration: description || 'Mobile money transfer',
        currency: 'XAF',
        reference: transaction_ref,
        beneficiary_name: beneficiary_name || 'Beneficiary',
        callback_url: 'https://api.kangopenbanking.com/v1/mobile-money-verify',
      }),
    });

    const flutterwaveData = await flutterwaveResponse.json();
    console.log('Flutterwave transfer response:', flutterwaveData);

    if (flutterwaveData.status === 'success') {
      // Update transaction with Flutterwave reference
      await supabase
        .from('mobile_money_transactions')
        .update({
          flutterwave_ref: flutterwaveData.data.id.toString(),
          status: 'processing',
          metadata: flutterwaveData.data,
          completed_at: flutterwaveData.data.status === 'SUCCESSFUL' ? new Date().toISOString() : null
        })
        .eq('id', transactionData.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: transactionData.id,
            transaction_ref,
            flutterwave_ref: flutterwaveData.data.id.toString(),
            status: flutterwaveData.data.status === 'SUCCESSFUL' ? 'successful' : 'processing',
            message: 'Transfer initiated successfully'
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
          error_message: flutterwaveData.message || 'Transfer initiation failed'
        })
        .eq('id', transactionData.id);

      throw new Error(flutterwaveData.message || 'Transfer initiation failed');
    }

  } catch (error) {
    console.error('Error in mobile-money-transfer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        code: 'MOBILE_MONEY_TRANSFER_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
