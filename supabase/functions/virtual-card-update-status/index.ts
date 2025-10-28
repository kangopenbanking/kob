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

    const { card_id, status } = await req.json();

    if (!card_id || !status) {
      throw new Error('Missing required fields: card_id, status');
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'blocked', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be: active, inactive, blocked, or cancelled');
    }

    // Verify card ownership
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('*')
      .eq('id', card_id)
      .eq('user_id', user.id)
      .single();

    if (!card) {
      throw new Error('Card not found or access denied');
    }

    // Map status to Stripe status
    const stripeStatusMap: Record<string, string> = {
      'active': 'active',
      'inactive': 'inactive',
      'blocked': 'inactive',
      'cancelled': 'canceled'
    };

    const stripeStatus = stripeStatusMap[status];

    // Update in Stripe
    console.log('Updating card status in Stripe:', { cardId: card.stripe_card_id, status: stripeStatus });
    
    await stripe.issuing.cards.update(card.stripe_card_id, {
      status: stripeStatus as any,
    });

    // Update in database
    const { error: updateError } = await supabase
      .from('virtual_cards')
      .update({ status: status as any })
      .eq('id', card_id);

    if (updateError) {
      console.error('Failed to update card status:', updateError);
      throw new Error('Failed to update card status');
    }

    console.log('Card status updated successfully');

    return new Response(
      JSON.stringify({
        card_id: card_id,
        status: status,
        message: `Card ${status === 'active' ? 'activated' : status === 'inactive' ? 'frozen' : status === 'blocked' ? 'blocked' : 'cancelled'} successfully`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in virtual-card-update-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'VIRTUAL_CARD_UPDATE_STATUS_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
