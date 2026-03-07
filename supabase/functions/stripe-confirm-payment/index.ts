import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from 'https://esm.sh/stripe@14.21.0';

import { corsHeaders } from "../_shared/cors.ts";
};

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

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    
    // Verify webhook signature if present
    if (signature) {
      const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } else {
        event = JSON.parse(body);
      }
    } else {
      event = JSON.parse(body);
    }

    console.log('Stripe webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);

        // Update transaction record
        const { error: updateError } = await supabase
          .from('card_payment_transactions')
          .update({
            status: 'successful',
            stripe_charge_id: paymentIntent.latest_charge,
            completed_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.error('Failed to update transaction:', updateError);
        }

        // Get transaction details for fee recording
        const { data: transaction } = await supabase
          .from('card_payment_transactions')
          .select('*, user_id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single();

        if (transaction) {
          // Get user's institution_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('institution_id')
            .eq('id', transaction.user_id)
            .single();

          if (profile?.institution_id) {
            // Record transaction fee
            await supabase.rpc('record_transaction_fee', {
              _institution_id: profile.institution_id,
              _transaction_type: 'card_payment',
              _transaction_ref: transaction.transaction_ref,
              _transaction_amount: transaction.amount,
              _transaction_id: transaction.id,
              _metadata: {
                stripe_payment_intent_id: paymentIntent.id,
                card_brand: transaction.card_brand,
              }
            });
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('Payment failed:', paymentIntent.id);

        const { error: updateError } = await supabase
          .from('card_payment_transactions')
          .update({
            status: 'failed',
            error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.error('Failed to update transaction:', updateError);
        }

        break;
      }

      case 'payment_method.attached': {
        const paymentMethod = event.data.object;
        console.log('Payment method attached:', paymentMethod.id);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    // Log full details server-side for debugging
    console.error('[STRIPE-WEBHOOK] Error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      webhook_type: 'stripe_payment',
      timestamp: new Date().toISOString()
    });
    
    // Return generic error to external webhook caller
    return new Response(
      JSON.stringify({ 
        received: false,
        message: 'Processing error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
