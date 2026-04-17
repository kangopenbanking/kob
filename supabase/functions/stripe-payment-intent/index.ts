import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from 'https://esm.sh/stripe@14.21.0';

import { corsHeaders } from "../_shared/cors.ts";
import { toStripeAmount } from "../_shared/gateway-adapters.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

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

    const { amount, currency, description, save_card } = await req.json();

    console.log('Creating payment intent:', { amount, currency, description, user_id: user.id });

    if (!amount || !currency) {
      throw new Error('Missing required fields: amount, currency');
    }

    // Generate transaction reference
    const transaction_ref = `CARD-${crypto.randomUUID()}`;

    // Zero-decimal currencies (XAF, XOF, JPY, etc.) handled via shared helper
    // to prevent drift with the rest of the gateway adapter layer.
    const stripeAmount = toStripeAmount(amount, currency);

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: currency.toLowerCase(),
      description: description || 'Card payment',
      metadata: {
        user_id: user.id,
        transaction_ref,
      },
      setup_future_usage: save_card ? 'off_session' : undefined,
    });

    console.log('Payment intent created:', paymentIntent.id);

    // Create transaction record
    const { error: insertError } = await supabase
      .from('card_payment_transactions')
      .insert({
        user_id: user.id,
        transaction_ref,
        stripe_payment_intent_id: paymentIntent.id,
        transaction_type: 'charge',
        amount,
        currency: currency.toUpperCase(),
        status: 'pending',
        description,
        customer_email: user.email,
      });

    if (insertError) {
      console.error('Failed to create transaction record:', insertError);
      throw new Error('Failed to create transaction record');
    }

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        transaction_ref,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in stripe-payment-intent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'STRIPE_PAYMENT_INTENT_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
