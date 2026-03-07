import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";

async function cardyfieRequest(method: string, path: string) {
  const baseUrl = Deno.env.get('CARDYFIE_BASE_URL')!;
  const apiKey = Deno.env.get('CARDYFIE_API_KEY')!;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Cardyfie API error:', data);
    throw new Error(data?.message?.error?.[0] || 'Cardyfie API error');
  }

  return data;
}

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
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authorization token');

    const url = new URL(req.url);
    const cardId = url.searchParams.get('card_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!cardId) throw new Error('Missing card_id parameter');

    // Verify card ownership
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (!card) throw new Error('Card not found or access denied');

    // Fetch transactions from Cardyfie
    console.log('Fetching transactions from Cardyfie for card:', card.stripe_card_id);

    try {
      const cardyfieData = await cardyfieRequest('GET', `/card/transactions?card_ulid=${card.stripe_card_id}`);
      const cardyfieTxns = cardyfieData?.data?.transactions || [];

      // Sync Cardyfie transactions to database
      for (const tx of cardyfieTxns) {
        await supabase
          .from('card_transactions')
          .upsert({
            virtual_card_id: cardId,
            user_id: user.id,
            stripe_transaction_id: tx.trx_id || tx.ulid,
            amount_usd: Math.abs(parseFloat(tx.enter_amount || '0')),
            merchant_name: tx.trx_type || 'Transaction',
            transaction_type: tx.amount_type === 'credit' ? 'refund' : 'capture',
            status: tx.status || 'completed',
            metadata: {
              cardyfie_ulid: tx.ulid,
              card_currency: tx.card_currency,
              amount_type: tx.amount_type,
            },
            created_at: tx.created_at || new Date().toISOString()
          }, {
            onConflict: 'stripe_transaction_id'
          });
      }
    } catch (syncError) {
      console.error('Failed to sync Cardyfie transactions:', syncError);
      // Continue to return local data even if Cardyfie sync fails
    }

    // Fetch from database
    const { data: transactions, error: txError } = await supabase
      .from('card_transactions')
      .select('*')
      .eq('virtual_card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (txError) throw new Error('Failed to fetch transactions');

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
