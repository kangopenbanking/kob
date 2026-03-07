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

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const url = `${baseUrl}${path}`;
  console.log(`Cardyfie ${method} ${url}`);
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error('Cardyfie API error:', data);
    throw new Error(data?.message?.error?.[0] || data?.error || 'Cardyfie API error');
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

    const { card_name, program_id, spending_limits } = await req.json();

    console.log('Creating virtual card for user:', user.id);

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('User profile not found');

    // Check if Cardyfie customer exists
    let { data: cardholder } = await supabase
      .from('stripe_cardholders')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Create Cardyfie customer if doesn't exist
    if (!cardholder) {
      console.log('Creating Cardyfie customer...');

      const nameParts = (profile.full_name || 'User').split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      const customerData = await cardyfieRequest('POST', '/card-customer/create', {
        first_name: firstName,
        last_name: lastName,
        email: user.email || profile.email,
        date_of_birth: '1990-01-01',
        id_type: 'passport',
        id_number: `KOB-${user.id.substring(0, 8)}`,
        id_front_image: 'https://kangopenbanking.com/placeholder-id.png',
        user_image: 'https://kangopenbanking.com/placeholder-user.png',
        house_number: '1',
        address_line_1: 'Douala, Cameroon',
        city: 'Douala',
        state: 'Littoral',
        zip_code: '00000',
        country: 'CM',
        reference_id: `kob-${user.id}`,
        'meta[user_id]': user.id,
      });

      const cardyfieCustomer = customerData?.data?.customer;
      if (!cardyfieCustomer) throw new Error('Failed to create Cardyfie customer');

      const { data: newCardholder, error: cardholderError } = await supabase
        .from('stripe_cardholders')
        .insert({
          user_id: user.id,
          stripe_cardholder_id: cardyfieCustomer.ulid,
          name: profile.full_name || user.email!,
          email: user.email!,
          status: cardyfieCustomer.status || 'active',
        })
        .select()
        .single();

      if (cardholderError) {
        console.error('Failed to save customer:', cardholderError);
        throw new Error('Failed to save customer record');
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

    if (!program) throw new Error('Invalid card program');

    // Issue virtual card via Cardyfie
    console.log('Issuing Cardyfie virtual card...');

    const cardData = await cardyfieRequest('POST', '/card/issue', {
      customer_ulid: cardholder.stripe_cardholder_id,
      card_name: card_name || 'My Virtual Card',
      card_currency: 'USD',
      card_type: 'universal',
      card_provider: 'visa',
      reference_id: `kob-card-${crypto.randomUUID().substring(0, 8)}`,
      'meta[user_id]': user.id,
    });

    const cardyfieCard = cardData?.data?.virtual_card;
    if (!cardyfieCard) throw new Error('Failed to issue virtual card');

    // Extract last4 from masked_pan
    const maskedPan = cardyfieCard.masked_pan || '';
    const last4 = maskedPan.slice(-4) || '0000';

    // Parse expiry
    const expTime = cardyfieCard.card_exp_time || '';
    let expMonth = 12;
    let expYear = 2030;
    if (expTime) {
      const parts = expTime.split('/');
      if (parts.length === 2) {
        expMonth = parseInt(parts[0]) || 12;
        expYear = parseInt(parts[1]) || 2030;
        if (expYear < 100) expYear += 2000;
      }
    }

    // Save card to database
    const { data: virtualCard, error: cardError } = await supabase
      .from('virtual_cards')
      .insert({
        user_id: user.id,
        cardholder_id: cardholder.id,
        program_id: program_id,
        stripe_card_id: cardyfieCard.ulid,
        card_name: card_name || 'My Virtual Card',
        last4: last4,
        exp_month: expMonth,
        exp_year: expYear,
        brand: cardyfieCard.card_provider || 'visa',
        status: cardyfieCard.status === 'ENABLED' ? 'active' : 'processing',
        balance_usd: parseFloat(cardyfieCard.card_balance || '0'),
        spending_controls: spending_limits || {},
      })
      .select()
      .single();

    if (cardError) {
      console.error('Failed to save card:', cardError);
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
