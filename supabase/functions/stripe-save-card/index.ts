import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from 'https://esm.sh/stripe@14.21.0';

import { corsHeaders } from "../_shared/cors.ts";

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

    const { payment_method_id, billing_name, set_as_default } = await req.json();

    console.log('Saving card for user:', user.id);

    if (!payment_method_id) {
      throw new Error('Missing payment_method_id');
    }

    // Retrieve payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

    if (!paymentMethod.card) {
      throw new Error('Invalid payment method type');
    }

    // Check if card already exists
    const { data: existingCard } = await supabase
      .from('saved_cards')
      .select('id')
      .eq('stripe_payment_method_id', payment_method_id)
      .eq('user_id', user.id)
      .single();

    if (existingCard) {
      return new Response(
        JSON.stringify({ 
          message: 'Card already saved',
          card_id: existingCard.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // If set as default, unset other defaults
    if (set_as_default) {
      await supabase
        .from('saved_cards')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    // Save card to database
    const { data: savedCard, error: insertError } = await supabase
      .from('saved_cards')
      .insert({
        user_id: user.id,
        stripe_payment_method_id: payment_method_id,
        card_brand: paymentMethod.card.brand,
        card_last4: paymentMethod.card.last4,
        card_exp_month: paymentMethod.card.exp_month,
        card_exp_year: paymentMethod.card.exp_year,
        card_country: paymentMethod.card.country,
        billing_name: billing_name || paymentMethod.billing_details?.name,
        is_default: set_as_default || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save card:', insertError);
      throw new Error('Failed to save card');
    }

    console.log('Card saved successfully:', savedCard.id);

    return new Response(
      JSON.stringify({
        card: savedCard,
        message: 'Card saved successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in stripe-save-card:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'STRIPE_SAVE_CARD_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
