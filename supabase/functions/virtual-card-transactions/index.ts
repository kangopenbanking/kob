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

    const url = new URL(req.url);
    const cardId = url.searchParams.get('card_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!cardId) {
      throw new Error('Missing card_id parameter');
    }

    // Verify card ownership
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (!card) {
      throw new Error('Card not found or access denied');
    }

    // Fetch transactions from Stripe
    console.log('Fetching transactions from Stripe for card:', card.stripe_card_id);
    
    const stripeTransactions = await stripe.issuing.transactions.list({
      card: card.stripe_card_id,
      limit: limit,
    });

    // Sync transactions to database
    for (const tx of stripeTransactions.data) {
      const { error: syncError } = await supabase
        .from('card_transactions')
        .upsert({
          virtual_card_id: cardId,
          user_id: user.id,
          stripe_transaction_id: tx.id,
          stripe_authorization_id: tx.authorization,
          amount_usd: Math.abs(tx.amount) / 100, // Convert from cents
          merchant_name: tx.merchant_data?.name || 'Unknown',
          merchant_category: tx.merchant_data?.category || '',
          merchant_country: tx.merchant_data?.country || '',
          transaction_type: tx.type === 'capture' ? 'capture' : 'authorization',
          status: tx.type,
          metadata: {
            currency: tx.currency,
            stripe_created: tx.created,
            merchant_data: tx.merchant_data
          },
          created_at: new Date(tx.created * 1000).toISOString()
        }, {
          onConflict: 'stripe_transaction_id'
        });

      if (syncError) {
        console.error('Failed to sync transaction:', syncError);
      }
    }

    // Fetch from database to return consistent format
    const { data: transactions, error: txError } = await supabase
      .from('card_transactions')
      .select('*')
      .eq('virtual_card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (txError) {
      console.error('Failed to fetch transactions:', txError);
      throw new Error('Failed to fetch transactions');
    }

    return new Response(
      JSON.stringify({
        transactions: transactions || [],
        total: transactions?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in virtual-card-transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'VIRTUAL_CARD_TRANSACTIONS_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
