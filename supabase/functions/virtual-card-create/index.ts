import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from 'https://esm.sh/stripe@14.21.0';

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

    const { card_name, program_id, spending_limits } = await req.json();

    console.log('Creating virtual card for user:', user.id);

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Check if cardholder exists
    let { data: cardholder } = await supabase
      .from('stripe_cardholders')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Create cardholder if doesn't exist
    if (!cardholder) {
      console.log('Creating Stripe cardholder...');
      
      const stripeCardholder = await stripe.issuing.cardholders.create({
        name: profile.full_name || user.email || 'Cardholder',
        email: user.email!,
        phone_number: '+237000000000', // Default for now
        billing: {
          address: {
            line1: '123 Main Street',
            city: 'Douala',
            state: 'LT',
            postal_code: '00000',
            country: 'CM',
          }
        },
        type: 'individual',
        status: 'active',
      });

      const { data: newCardholder, error: cardholderError } = await supabase
        .from('stripe_cardholders')
        .insert({
          user_id: user.id,
          stripe_cardholder_id: stripeCardholder.id,
          name: profile.full_name || user.email!,
          email: user.email!,
          status: 'active',
        })
        .select()
        .single();

      if (cardholderError) {
        console.error('Failed to save cardholder:', cardholderError);
        throw new Error('Failed to save cardholder');
      }

      cardholder = newCardholder;
    }

    // Get program details
    const { data: program } = await supabase
      .from('virtual_card_programs')
      .select('*')
      .eq('id', program_id)
      .eq('is_active', true)
      .single();

    if (!program) {
      throw new Error('Invalid card program');
    }

    // Create virtual card in Stripe
    console.log('Creating Stripe virtual card...');
    
    const spendingControls: any = {
      spending_limits: []
    };

    // Add spending limits from program or custom
    if (spending_limits?.monthly_limit) {
      spendingControls.spending_limits.push({
        amount: Math.round(spending_limits.monthly_limit * 100),
        interval: 'monthly'
      });
    } else if (program.monthly_spend_limit) {
      spendingControls.spending_limits.push({
        amount: Math.round(program.monthly_spend_limit * 100),
        interval: 'monthly'
      });
    }

    if (spending_limits?.daily_limit) {
      spendingControls.spending_limits.push({
        amount: Math.round(spending_limits.daily_limit * 100),
        interval: 'daily'
      });
    } else if (program.daily_spend_limit) {
      spendingControls.spending_limits.push({
        amount: Math.round(program.daily_spend_limit * 100),
        interval: 'daily'
      });
    }

    const stripeCard = await stripe.issuing.cards.create({
      cardholder: cardholder.stripe_cardholder_id,
      currency: 'usd',
      type: 'virtual',
      spending_controls: spendingControls,
      status: 'active',
    });

    // Save card to database
    const { data: virtualCard, error: cardError } = await supabase
      .from('virtual_cards')
      .insert({
        user_id: user.id,
        cardholder_id: cardholder.id,
        program_id: program_id,
        stripe_card_id: stripeCard.id,
        card_name: card_name || 'My Virtual Card',
        last4: stripeCard.last4,
        exp_month: stripeCard.exp_month,
        exp_year: stripeCard.exp_year,
        brand: stripeCard.brand,
        status: 'active',
        balance_usd: 0,
        spending_controls: spendingControls,
      })
      .select()
      .single();

    if (cardError) {
      console.error('Failed to save card:', cardError);
      // Try to cancel Stripe card
      await stripe.issuing.cards.update(stripeCard.id, { status: 'canceled' });
      throw new Error('Failed to save card');
    }

    console.log('Virtual card created successfully:', virtualCard.id);

    return new Response(
      JSON.stringify({
        card: virtualCard,
        message: 'Virtual card created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in virtual-card-create:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'VIRTUAL_CARD_CREATE_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
