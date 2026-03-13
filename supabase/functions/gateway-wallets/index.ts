import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { creditFundingIntent } from "../_shared/funding-scope-creditor.ts";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  // Expected paths: gateway-wallets, gateway-wallets/{id}, gateway-wallets/{id}/{action}
  const walletId = pathParts[1] || null;
  const action = pathParts[2] || null;

  try {
    // POST /gateway-wallets — Create wallet
    if (req.method === 'POST' && !walletId) {
      return await createWallet(supabase, user, req);
    }

    // GET /gateway-wallets/{id} — Get wallet with balances
    if (req.method === 'GET' && walletId && !action) {
      return await getWallet(supabase, user, walletId, url);
    }

    // POST /gateway-wallets/{id}/credit
    if (req.method === 'POST' && walletId && action === 'credit') {
      return await creditWallet(supabase, user, walletId, req);
    }

    // POST /gateway-wallets/{id}/debit
    if (req.method === 'POST' && walletId && action === 'debit') {
      return await debitWallet(supabase, user, walletId, req);
    }

    // GET /gateway-wallets/{id}/transactions
    if (req.method === 'GET' && walletId && action === 'transactions') {
      return await getWalletTransactions(supabase, user, walletId, url);
    }

    // POST /gateway-wallets/{id}/freeze
    if (req.method === 'POST' && walletId && action === 'freeze') {
      return await freezeWallet(supabase, user, walletId, req);
    }

    return rfc7807('not_found', 'Not Found', 404, `Route not matched: ${req.method} ${url.pathname}`);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-wallets] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});

// ─── Create Wallet ───
async function createWallet(supabase: any, user: any, req: Request) {
  const body = await req.json();
  const {
    account_holder_name,
    currency = 'XAF',
    account_subtype = 'CurrentAccount',
    nickname,
  } = body;

  if (!account_holder_name) return rfc7807('validation_error', 'Validation Error', 400, 'account_holder_name is required');

  // Idempotency check
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('accounts')
      .select('id, account_id')
      .eq('user_id', user.id)
      .eq('secondary_identification', `idem:${idempotencyKey}`)
      .maybeSingle();
    if (existing) return json({ wallet_id: existing.id, account_id: existing.account_id, idempotent_replay: true });
  }

  const accountId = `KANG-W-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const KANG_PLATFORM_ID = 'f493095b-037a-40cf-82bc-3a3ab74550dd';

  const { data: account, error: insertErr } = await supabase.from('accounts').insert({
    user_id: user.id,
    account_holder_name,
    account_id: accountId,
    identification_value: accountId,
    identification_scheme: 'KANG',
    account_type: 'Personal',
    account_subtype,
    currency,
    nickname: nickname || 'Wallet',
    institution_id: KANG_PLATFORM_ID,
    is_active: true,
    opened_date: new Date().toISOString(),
    secondary_identification: idempotencyKey ? `idem:${idempotencyKey}` : null,
  }).select().single();

  if (insertErr) throw insertErr;

  // Initialize zero balance
  await supabase.from('account_balances').insert({
    account_id: account.id,
    balance_type: 'ClosingAvailable',
    amount: 0,
    currency,
    credit_debit_indicator: 'Credit',
    balance_datetime: new Date().toISOString(),
  });

  await supabase.from('audit_logs').insert({
    action_type: 'wallet_created', entity_type: 'wallet', entity_id: account.id,
    performed_by: user.id, details: { account_id: accountId, currency },
  });

  return json({
    wallet_id: account.id,
    account_id: accountId,
    holder_name: account_holder_name,
    currency,
    status: 'active',
    created_at: account.created_at,
    balances: { available: 0, currency },
  }, 201);
}

// ─── Get Wallet ───
async function getWallet(supabase: any, user: any, walletId: string, url: URL) {
  const { data: account } = await supabase
    .from('accounts').select('*')
    .eq('id', walletId).eq('user_id', user.id).single();

  if (!account) return rfc7807('not_found', 'Wallet Not Found', 404, 'Wallet does not exist or access denied');

  const { data: balances } = await supabase
    .from('account_balances').select('*')
    .eq('account_id', walletId)
    .order('balance_datetime', { ascending: false });

  return json({
    wallet_id: account.id,
    account_id: account.account_id,
    holder_name: account.account_holder_name,
    currency: account.currency,
    status: account.is_active ? 'active' : 'frozen',
    created_at: account.created_at,
    balances: (balances || []).map((b: any) => ({
      type: b.balance_type,
      amount: b.amount,
      currency: b.currency,
      indicator: b.credit_debit_indicator,
      as_of: b.balance_datetime,
    })),
  });
}

// ─── Credit Wallet ───
async function creditWallet(supabase: any, user: any, walletId: string, req: Request) {
  const body = await req.json();
  const { amount, currency = 'XAF', reference, description } = body;

  if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be a positive number');

  // Idempotency
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('account_id', walletId)
      .eq('credit_debit_indicator', 'Credit')
      .contains('metadata', { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existing) return json({ transaction_id: existing.id, idempotent_replay: true });
  }

  const { data: account } = await supabase
    .from('accounts').select('id, user_id, is_active')
    .eq('id', walletId).single();

  if (!account) return rfc7807('not_found', 'Wallet Not Found', 404, 'Wallet does not exist');
  if (!account.is_active) return rfc7807('wallet_frozen', 'Wallet Frozen', 403, 'Cannot credit a frozen wallet');

  // Use shared creditor logic
  const now = new Date().toISOString();
  const { data: existingBalance } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', walletId)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  if (existingBalance) {
    await supabase.from('account_balances').update({
      amount: existingBalance.amount + amount,
      balance_datetime: now,
    }).eq('id', existingBalance.id);
  } else {
    await supabase.from('account_balances').insert({
      account_id: walletId, balance_type: 'ClosingAvailable', amount,
      currency, credit_debit_indicator: 'Credit', balance_datetime: now,
    });
  }

  const ref = reference || `API-CR-${Date.now()}`;
  const { data: tx } = await supabase.from('transactions').insert({
    account_id: walletId, amount, currency, credit_debit_indicator: 'Credit',
    status: 'Booked', booking_datetime: now, value_datetime: now,
    transaction_type: 'deposit', user_id: account.user_id,
    transaction_information: description || `Programmatic credit via Wallet API - ${ref}`,
    metadata: { source: 'wallet_api', reference: ref, idempotency_key: idempotencyKey },
  }).select('id').single();

  await supabase.from('audit_logs').insert({
    action_type: 'wallet_credited', entity_type: 'wallet', entity_id: walletId,
    performed_by: user.id, details: { amount, currency, reference: ref },
  });

  return json({
    transaction_id: tx?.id,
    wallet_id: walletId,
    amount,
    currency,
    new_balance: (existingBalance?.amount || 0) + amount,
    reference: ref,
    status: 'completed',
  }, 201);
}

// ─── Debit Wallet ───
async function debitWallet(supabase: any, user: any, walletId: string, req: Request) {
  const body = await req.json();
  const { amount, currency = 'XAF', reference, description } = body;

  if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be a positive number');

  // Idempotency
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('account_id', walletId)
      .eq('credit_debit_indicator', 'Debit')
      .contains('metadata', { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existing) return json({ transaction_id: existing.id, idempotent_replay: true });
  }

  const { data: account } = await supabase
    .from('accounts').select('id, user_id, is_active')
    .eq('id', walletId).single();

  if (!account) return rfc7807('not_found', 'Wallet Not Found', 404, 'Wallet does not exist');
  if (!account.is_active) return rfc7807('wallet_frozen', 'Wallet Frozen', 403, 'Cannot debit a frozen wallet');

  const { data: balanceRecord } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', walletId)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  const currentBalance = balanceRecord?.amount || 0;
  if (currentBalance < amount) {
    return rfc7807('insufficient_funds', 'Insufficient Funds', 400, `Available: ${currentBalance}, Requested: ${amount}`);
  }

  const now = new Date().toISOString();
  await supabase.from('account_balances').update({
    amount: currentBalance - amount,
    balance_datetime: now,
  }).eq('id', balanceRecord.id);

  const ref = reference || `API-DR-${Date.now()}`;
  const { data: tx } = await supabase.from('transactions').insert({
    account_id: walletId, amount, currency, credit_debit_indicator: 'Debit',
    status: 'Booked', booking_datetime: now, value_datetime: now,
    transaction_type: 'withdrawal', user_id: account.user_id,
    transaction_information: description || `Programmatic debit via Wallet API - ${ref}`,
    metadata: { source: 'wallet_api', reference: ref, idempotency_key: idempotencyKey },
  }).select('id').single();

  await supabase.from('audit_logs').insert({
    action_type: 'wallet_debited', entity_type: 'wallet', entity_id: walletId,
    performed_by: user.id, details: { amount, currency, reference: ref },
  });

  return json({
    transaction_id: tx?.id,
    wallet_id: walletId,
    amount,
    currency,
    new_balance: currentBalance - amount,
    reference: ref,
    status: 'completed',
  }, 201);
}

// ─── Get Wallet Transactions ───
async function getWalletTransactions(supabase: any, user: any, walletId: string, url: URL) {
  const { data: account } = await supabase
    .from('accounts').select('id')
    .eq('id', walletId).eq('user_id', user.id).single();

  if (!account) return rfc7807('not_found', 'Wallet Not Found', 404, 'Wallet does not exist or access denied');

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const type = url.searchParams.get('type'); // 'credit' | 'debit'

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('account_id', walletId)
    .order('booking_datetime', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type === 'credit') query = query.eq('credit_debit_indicator', 'Credit');
  if (type === 'debit') query = query.eq('credit_debit_indicator', 'Debit');

  const { data: transactions, count } = await query;

  return json({
    wallet_id: walletId,
    transactions: (transactions || []).map((t: any) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      type: t.credit_debit_indicator === 'Credit' ? 'credit' : 'debit',
      status: t.status,
      description: t.transaction_information,
      booked_at: t.booking_datetime,
      metadata: t.metadata,
    })),
    pagination: { total: count, limit, offset },
  });
}

// ─── Freeze / Unfreeze Wallet ───
async function freezeWallet(supabase: any, user: any, walletId: string, req: Request) {
  const body = await req.json();
  const { freeze, reason } = body;

  if (typeof freeze !== 'boolean') return rfc7807('validation_error', 'Validation Error', 400, 'freeze must be a boolean');

  // Admin-only: check role
  const { data: roles } = await supabase
    .from('user_roles').select('role')
    .eq('user_id', user.id);

  const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
  if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can freeze/unfreeze wallets');

  const { data: account } = await supabase
    .from('accounts').select('id, is_active')
    .eq('id', walletId).single();

  if (!account) return rfc7807('not_found', 'Wallet Not Found', 404, 'Wallet does not exist');

  await supabase.from('accounts').update({ is_active: !freeze }).eq('id', walletId);

  await supabase.from('audit_logs').insert({
    action_type: freeze ? 'wallet_frozen' : 'wallet_unfrozen',
    entity_type: 'wallet', entity_id: walletId,
    performed_by: user.id, details: { reason, previous_state: account.is_active ? 'active' : 'frozen' },
  });

  return json({
    wallet_id: walletId,
    status: freeze ? 'frozen' : 'active',
    reason,
  });
}
