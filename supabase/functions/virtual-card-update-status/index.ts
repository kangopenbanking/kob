import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";

async function cardyfieRequest(method: string, path: string, body?: any) {
  const baseUrl = Deno.env.get('CARDYFIE_BASE_URL')!;
  const apiKey = Deno.env.get('CARDYFIE_API_KEY')!;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${baseUrl}${path}`, options);
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

    const { card_id, status } = await req.json();

    if (!card_id || !status) throw new Error('Missing required fields: card_id, status');

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

    if (!card) throw new Error('Card not found or access denied');

    // Map status to Cardyfie action
    const cardUlid = card.stripe_card_id;
    console.log('Updating card status via Cardyfie:', { cardUlid, status });

    if (status === 'inactive' || status === 'blocked') {
      await cardyfieRequest('POST', `/card/freeze/${cardUlid}`);
    } else if (status === 'active') {
      await cardyfieRequest('POST', `/card/unfreeze/${cardUlid}`);
    } else if (status === 'cancelled') {
      await cardyfieRequest('POST', `/card/close/${cardUlid}`);
    }

    // Update in database
    const { error: updateError } = await supabase
      .from('virtual_cards')
      .update({ status: status as any })
      .eq('id', card_id);

    if (updateError) throw new Error('Failed to update card status');

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
