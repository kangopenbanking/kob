import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface ProcessPaymentRequest {
  api_key: string;
  woocommerce_order_id: string;
  payment_method: 'mobile_money' | 'card' | 'bank_transfer';
  amount: number;
  currency: string;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  return_url?: string;
  metadata?: Record<string, any>;
}

async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const body: ProcessPaymentRequest = await req.json();
    const { 
      api_key, 
      woocommerce_order_id, 
      payment_method, 
      amount, 
      currency,
      customer_email,
      customer_phone,
      customer_name,
      return_url,
      metadata 
    } = body;

    // Validate required fields
    if (!api_key || !woocommerce_order_id || !payment_method || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing payment for order: ${woocommerce_order_id}, method: ${payment_method}`);

    // Hash API key to look up merchant
    const encoder = new TextEncoder();
    const apiKeyHash = await crypto.subtle.digest('SHA-256', encoder.encode(api_key));
    const apiKeyHashHex = Array.from(new Uint8Array(apiKeyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Find merchant
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('woocommerce_merchants')
      .select('*')
      .eq('api_key_hash', apiKeyHashHex)
      .single();

    if (merchantError || !merchant || merchant.status !== 'active') {
      console.error('Invalid or inactive merchant');
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive merchant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique transaction reference
    const transactionRef = `wfk_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // Create pending transaction record
    const { data: transaction, error: txError } = await supabaseClient
      .from('woocommerce_transactions')
      .insert({
        merchant_id: merchant.id,
        woocommerce_order_id,
        transaction_ref: transactionRef,
        payment_method,
        amount,
        currency,
        customer_email,
        customer_phone,
        status: 'pending',
        metadata: {
          ...metadata,
          customer_name,
          return_url
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('Error creating transaction:', txError);
      throw txError;
    }

    console.log(`Transaction created: ${transaction.id}`);

    // Route to appropriate payment processor based on payment method
    let processingResult: any;
    let paymentUrl: string | null = null;

    switch (payment_method) {
      case 'mobile_money':
        // Call mobile money charge function
        const { data: mmData, error: mmError } = await supabaseClient.functions.invoke(
          'facilitated-mobile-money-charge',
          {
            body: {
              phone_number: customer_phone,
              amount,
              currency,
              facilitated_institution_id: merchant.user_id, // Link to merchant's account
              metadata: {
                woocommerce_order_id,
                transaction_ref: transactionRef,
                source: 'woo_for_kang'
              }
            }
          }
        );
        
        if (mmError) throw mmError;
        processingResult = mmData;
        break;

      case 'card':
        // Call Stripe payment intent function
        const { data: stripeData, error: stripeError } = await supabaseClient.functions.invoke(
          'stripe-payment-intent',
          {
            body: {
              amount,
              currency,
              customer_email,
              description: `WooCommerce Order #${woocommerce_order_id}`,
              metadata: {
                woocommerce_order_id,
                transaction_ref: transactionRef,
                merchant_id: merchant.id,
                source: 'woo_for_kang'
              }
            }
          }
        );
        
        if (stripeError) throw stripeError;
        processingResult = stripeData;
        paymentUrl = processingResult.payment_url;
        break;

      case 'bank_transfer':
        // Call facilitated bank transfer function
        const { data: btData, error: btError } = await supabaseClient.functions.invoke(
          'facilitated-bank-transfer',
          {
            body: {
              amount,
              currency,
              narration: `WooCommerce Order #${woocommerce_order_id}`,
              facilitated_institution_id: merchant.user_id,
              metadata: {
                woocommerce_order_id,
                transaction_ref: transactionRef,
                source: 'woo_for_kang'
              }
            }
          }
        );
        
        if (btError) throw btError;
        processingResult = btData;
        break;

      default:
        throw new Error(`Unsupported payment method: ${payment_method}`);
    }

    // Update transaction with processing details
    await supabaseClient
      .from('woocommerce_transactions')
      .update({ 
        status: 'processing',
        kob_transaction_id: processingResult.transaction_id,
        metadata: {
          ...transaction.metadata,
          processing_result: processingResult
        }
      })
      .eq('id', transaction.id);

    console.log(`Payment initiated successfully: ${transactionRef}`);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_ref: transactionRef,
        payment_method,
        status: 'processing',
        payment_url: paymentUrl,
        instructions: payment_method === 'mobile_money' 
          ? 'Please check your phone for the payment prompt'
          : payment_method === 'bank_transfer'
          ? 'You will receive bank transfer instructions via email'
          : 'Complete payment at the provided URL',
        message: 'Payment initiated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in woocommerce-process-payment:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Payment processing failed. Please try again.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
