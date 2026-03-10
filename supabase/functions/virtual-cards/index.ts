import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

async function cardyfieRequest(method: string, path: string, body?: any) {
  const baseUrl = Deno.env.get('CARDYFIE_BASE_URL')!;
  const apiKey = Deno.env.get('CARDYFIE_API_KEY')!;
  const options: RequestInit = {
    method,
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
  };
  if (body && (method === 'POST' || method === 'PUT')) options.body = JSON.stringify(body);
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  if (!response.ok) {
    console.error('Cardyfie API error:', data);
    throw new Error(data?.message?.error?.[0] || data?.error || 'Cardyfie API error');
  }
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authorization token');

    // Support both body-based action routing and query-param based (for transactions)
    const url = new URL(req.url);
    let action: string;
    let params: any;

    if (req.method === 'GET' || url.searchParams.has('card_id')) {
      // Legacy: virtual-card-transactions was called with query params
      action = 'transactions';
      params = {
        card_id: url.searchParams.get('card_id'),
        limit: url.searchParams.get('limit') || '50',
      };
    } else {
      const body = await req.json();
      action = body.action;
      params = body;
    }

    if (!action) throw new Error('Missing action parameter');

    switch (action) {
      case 'create': return await handleCreate(supabase, user, params);
      case 'list': return await handleList(supabase, user);
      case 'topup': return await handleTopup(supabase, user, params);
      case 'update-status': return await handleUpdateStatus(supabase, user, params);
      case 'transactions': return await handleTransactions(supabase, user, params);
      default: throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in virtual-cards:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, code: 'VIRTUAL_CARDS_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function ok(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
}

// ─── LIST ───
async function handleList(supabase: any, user: any) {
  const { data: cards, error: cardsError } = await supabase
    .from('virtual_cards')
    .select(`*, program:virtual_card_programs(*), cardholder:stripe_cardholders(*)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (cardsError) throw new Error('Failed to fetch cards');

  const cardsWithTransactions = await Promise.all(
    (cards || []).map(async (card: any) => {
      const { data: transactions } = await supabase
        .from('card_transactions').select('*').eq('virtual_card_id', card.id)
        .order('created_at', { ascending: false }).limit(5);
      return { ...card, recent_transactions: transactions || [] };
    })
  );

  return ok({ cards: cardsWithTransactions, total: cardsWithTransactions.length });
}

// ─── CREATE ───
async function handleCreate(supabase: any, user: any, params: any) {
  const { card_name, program_id, spending_limits } = params;
  console.log('Creating virtual card for user:', user.id);

  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();
  if (!profile) throw new Error('User profile not found');

  let { data: cardholder } = await supabase.from('stripe_cardholders').select('*').eq('user_id', user.id).single();

  if (!cardholder) {
    console.log('Creating Cardyfie customer...');
    const nameParts = (profile.full_name || 'User').split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';

    const customerData = await cardyfieRequest('POST', '/card-customer/create', {
      first_name: firstName, last_name: lastName, email: user.email || profile.email,
      date_of_birth: '1990-01-01', id_type: 'passport', id_number: `KOB-${user.id.substring(0, 8)}`,
      id_front_image: 'https://kangopenbanking.com/placeholder-id.png', user_image: 'https://kangopenbanking.com/placeholder-user.png',
      house_number: '1', address_line_1: 'Douala, Cameroon', city: 'Douala', state: 'Littoral', zip_code: '00000', country: 'CM',
      reference_id: `kob-${user.id}`, 'meta[user_id]': user.id,
    });

    const cardyfieCustomer = customerData?.data?.customer;
    if (!cardyfieCustomer) throw new Error('Failed to create Cardyfie customer');

    const { data: newCardholder, error: cardholderError } = await supabase
      .from('stripe_cardholders')
      .insert({ user_id: user.id, stripe_cardholder_id: cardyfieCustomer.ulid, name: profile.full_name || user.email!, email: user.email!, status: cardyfieCustomer.status || 'active' })
      .select().single();
    if (cardholderError) throw new Error('Failed to save customer record');
    cardholder = newCardholder;
  }

  const { data: program } = await supabase.from('virtual_card_programs').select('*').eq('id', program_id).eq('is_active', true).single();
  if (!program) throw new Error('Invalid card program');

  console.log('Issuing Cardyfie virtual card...');
  const cardData = await cardyfieRequest('POST', '/card/issue', {
    customer_ulid: cardholder.stripe_cardholder_id, card_name: card_name || 'My Virtual Card',
    card_currency: 'USD', card_type: 'universal', card_provider: 'visa',
    reference_id: `kob-card-${crypto.randomUUID().substring(0, 8)}`, 'meta[user_id]': user.id,
  });

  const cardyfieCard = cardData?.data?.virtual_card;
  if (!cardyfieCard) throw new Error('Failed to issue virtual card');

  const maskedPan = cardyfieCard.masked_pan || '';
  const last4 = maskedPan.slice(-4) || '0000';
  const expTime = cardyfieCard.card_exp_time || '';
  let expMonth = 12, expYear = 2030;
  if (expTime) {
    const parts = expTime.split('/');
    if (parts.length === 2) { expMonth = parseInt(parts[0]) || 12; expYear = parseInt(parts[1]) || 2030; if (expYear < 100) expYear += 2000; }
  }

  const { data: virtualCard, error: cardError } = await supabase
    .from('virtual_cards')
    .insert({
      user_id: user.id, cardholder_id: cardholder.id, program_id, stripe_card_id: cardyfieCard.ulid,
      card_name: card_name || 'My Virtual Card', last4, exp_month: expMonth, exp_year: expYear,
      brand: cardyfieCard.card_provider || 'visa', status: cardyfieCard.status === 'ENABLED' ? 'active' : 'processing',
      balance_usd: parseFloat(cardyfieCard.card_balance || '0'), spending_controls: spending_limits || {},
    })
    .select().single();
  if (cardError) throw new Error('Failed to save card');

  return ok({ card: virtualCard, message: 'Virtual card created successfully' });
}

// ─── TOPUP ───
async function handleTopup(supabase: any, user: any, params: any) {
  const { virtual_card_id, source_account_id, amount_source_currency, source_currency } = params;
  if (!virtual_card_id || !source_account_id || !amount_source_currency || !source_currency) throw new Error('Missing required fields');

  const { data: card } = await supabase.from('virtual_cards').select('*').eq('id', virtual_card_id).eq('user_id', user.id).single();
  if (!card) throw new Error('Virtual card not found');
  if (card.status !== 'active') throw new Error('Card is not active');

  const { data: account } = await supabase.from('accounts').select('*').eq('id', source_account_id).eq('user_id', user.id).single();
  if (!account) throw new Error('Source account not found');

  const { data: balance } = await supabase.from('account_balances').select('*').eq('account_id', source_account_id).eq('balance_type', 'InterimAvailable').single();
  if (!balance || parseFloat(balance.amount) < amount_source_currency) throw new Error('Insufficient balance');

  const { data: cachedRate } = await supabase.from('exchange_rates_cache').select('*').eq('base_currency', source_currency).eq('target_currency', 'USD').eq('rate_source', 'frankfurter').gt('valid_until', new Date().toISOString()).single();
  let exchangeRate: number, rateSource = 'frankfurter';

  if (cachedRate) { exchangeRate = parseFloat(cachedRate.rate); }
  else {
    const rateResponse = await fetch(`https://api.frankfurter.app/latest?from=${source_currency}&to=USD`);
    if (!rateResponse.ok) throw new Error('Failed to fetch exchange rate');
    const rateData = await rateResponse.json();
    exchangeRate = rateData.rates.USD;
    await supabase.from('exchange_rates_cache').upsert({ base_currency: source_currency, target_currency: 'USD', rate: exchangeRate, rate_source: 'frankfurter', valid_until: new Date(Date.now() + 3600000).toISOString() });
  }

  const conversionFeePercentage = 1.5;
  const usdBeforeFee = amount_source_currency * exchangeRate;
  const conversionFee = usdBeforeFee * (conversionFeePercentage / 100);
  const amountUsd = usdBeforeFee - conversionFee;
  const transactionRef = `TOPUP-${crypto.randomUUID()}`;

  await cardyfieRequest('POST', `/card/deposit/${card.stripe_card_id}`, { amount: amountUsd });

  const { data: fundingTx, error: fundingError } = await supabase.from('card_funding_transactions')
    .insert({ user_id: user.id, virtual_card_id, source_account_id, transaction_ref: transactionRef, amount_source_currency, source_currency, amount_usd: amountUsd, exchange_rate: exchangeRate, exchange_rate_source: rateSource, conversion_fee: conversionFee, status: 'completed', processed_at: new Date().toISOString() })
    .select().single();
  if (fundingError) throw new Error('Failed to create funding transaction');

  await supabase.from('account_balances').update({ amount: parseFloat(balance.amount) - amount_source_currency }).eq('id', balance.id);
  const newBalance = parseFloat(card.balance_usd) + amountUsd;
  await supabase.from('virtual_cards').update({ balance_usd: newBalance }).eq('id', virtual_card_id);

  return ok({ transaction: fundingTx, new_balance_usd: newBalance, conversion_details: { amount_source: amount_source_currency, source_currency, exchange_rate: exchangeRate, usd_before_fee: usdBeforeFee, conversion_fee: conversionFee, conversion_fee_percentage: conversionFeePercentage, final_usd: amountUsd }, message: 'Card topped up successfully' });
}

// ─── UPDATE STATUS ───
async function handleUpdateStatus(supabase: any, user: any, params: any) {
  const { card_id, status } = params;
  if (!card_id || !status) throw new Error('Missing required fields: card_id, status');

  const validStatuses = ['active', 'inactive', 'blocked', 'cancelled'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const { data: card } = await supabase.from('virtual_cards').select('*').eq('id', card_id).eq('user_id', user.id).single();
  if (!card) throw new Error('Card not found or access denied');

  const cardUlid = card.stripe_card_id;
  if (status === 'inactive' || status === 'blocked') await cardyfieRequest('POST', `/card/freeze/${cardUlid}`);
  else if (status === 'active') await cardyfieRequest('POST', `/card/unfreeze/${cardUlid}`);
  else if (status === 'cancelled') await cardyfieRequest('POST', `/card/close/${cardUlid}`);

  const { error: updateError } = await supabase.from('virtual_cards').update({ status: status as any }).eq('id', card_id);
  if (updateError) throw new Error('Failed to update card status');

  return ok({ card_id, status, message: `Card ${status === 'active' ? 'activated' : status === 'inactive' ? 'frozen' : status === 'blocked' ? 'blocked' : 'cancelled'} successfully` });
}

// ─── TRANSACTIONS ───
async function handleTransactions(supabase: any, user: any, params: any) {
  const cardId = params.card_id;
  const limit = parseInt(params.limit || '50');
  if (!cardId) throw new Error('Missing card_id parameter');

  const { data: card } = await supabase.from('virtual_cards').select('*').eq('id', cardId).eq('user_id', user.id).single();
  if (!card) throw new Error('Card not found or access denied');

  try {
    const cardyfieData = await cardyfieRequest('GET', `/card/transactions?card_ulid=${card.stripe_card_id}`);
    const cardyfieTxns = cardyfieData?.data?.transactions || [];
    for (const tx of cardyfieTxns) {
      await supabase.from('card_transactions').upsert({
        virtual_card_id: cardId, user_id: user.id, stripe_transaction_id: tx.trx_id || tx.ulid,
        amount_usd: Math.abs(parseFloat(tx.enter_amount || '0')), merchant_name: tx.trx_type || 'Transaction',
        transaction_type: tx.amount_type === 'credit' ? 'refund' : 'capture', status: tx.status || 'completed',
        metadata: { cardyfie_ulid: tx.ulid, card_currency: tx.card_currency, amount_type: tx.amount_type },
        created_at: tx.created_at || new Date().toISOString()
      }, { onConflict: 'stripe_transaction_id' });
    }
  } catch (syncError) { console.error('Failed to sync Cardyfie transactions:', syncError); }

  const { data: transactions, error: txError } = await supabase
    .from('card_transactions').select('*').eq('virtual_card_id', cardId)
    .order('created_at', { ascending: false }).limit(limit);
  if (txError) throw new Error('Failed to fetch transactions');

  return ok({ transactions: transactions || [], total: transactions?.length || 0 });
}
