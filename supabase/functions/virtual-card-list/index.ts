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

    // Get user's virtual cards
    const { data: cards, error: cardsError } = await supabase
      .from('virtual_cards')
      .select(`
        *,
        program:virtual_card_programs(*),
        cardholder:stripe_cardholders(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (cardsError) {
      console.error('Failed to fetch cards:', cardsError);
      throw new Error('Failed to fetch cards');
    }

    // Get recent transactions for each card
    const cardsWithTransactions = await Promise.all(
      (cards || []).map(async (card) => {
        const { data: transactions } = await supabase
          .from('card_transactions')
          .select('*')
          .eq('virtual_card_id', card.id)
          .order('created_at', { ascending: false })
          .limit(5);

        return {
          ...card,
          recent_transactions: transactions || []
        };
      })
    );

    return new Response(
      JSON.stringify({
        cards: cardsWithTransactions,
        total: cardsWithTransactions.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in virtual-card-list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'VIRTUAL_CARD_LIST_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
