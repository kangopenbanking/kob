import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateUserRole, errorResponse } from "../_shared/role-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const roleResult = await validateUserRole(req, ['admin', 'merchant']);
  if (!roleResult.valid) {
    return rfc7807('unauthorized', 'Unauthorized', roleResult.error === 'Missing authorization header' ? 401 : 403, roleResult.error!);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const escrowId = pathParts[1] || null;
  const action = pathParts[2] || null;
  const isAdmin = (roleResult.roles || []).includes('admin');

  try {
    // POST / — Create escrow wallet
    if (req.method === 'POST' && !escrowId) {
      return await createEscrow(supabase, roleResult, req, isAdmin);
    }

    // GET /{id} — Get escrow details
    if (req.method === 'GET' && escrowId && !action) {
      return await getEscrow(supabase, roleResult, escrowId, isAdmin);
    }

    // GET / — List escrow wallets
    if (req.method === 'GET' && !escrowId) {
      return await listEscrows(supabase, roleResult, url, isAdmin);
    }

    // POST /{id}/fund — Fund escrow
    if (req.method === 'POST' && escrowId && action === 'fund') {
      return await fundEscrow(supabase, roleResult, escrowId, req, isAdmin);
    }

    // POST /{id}/release — Release from escrow to recipient
    if (req.method === 'POST' && escrowId && action === 'release') {
      if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can release escrow funds');
      return await releaseEscrow(supabase, roleResult, escrowId, req);
    }

    // POST /{id}/refund — Refund escrow to funder
    if (req.method === 'POST' && escrowId && action === 'refund') {
      if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can refund escrow funds');
      return await refundEscrow(supabase, roleResult, escrowId, req);
    }

    // POST /{id}/freeze — Freeze/unfreeze escrow
    if (req.method === 'POST' && escrowId && action === 'freeze') {
      if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can freeze escrow wallets');
      return await freezeEscrow(supabase, roleResult, escrowId, req);
    }

    // GET /{id}/transactions — Escrow transaction history
    if (req.method === 'GET' && escrowId && action === 'transactions') {
      return await getEscrowTransactions(supabase, roleResult, escrowId, url, isAdmin);
    }

    return rfc7807('not_found', 'Not Found', 404, `Route not matched: ${req.method} ${url.pathname}`);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-escrow-wallets] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});

// ─── Helpers ───
async function getMerchantIds(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from('gateway_merchants').select('id').eq('user_id', userId);
  return (data || []).map((m: any) => m.id);
}

async function verifyEscrowAccess(supabase: any, escrowId: string, roleResult: any, isAdmin: boolean) {
  const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('id', escrowId).single();
  if (!escrow) return null;
  if (isAdmin) return escrow;
  const merchantIds = await getMerchantIds(supabase, roleResult.userId!);
  if (!merchantIds.includes(escrow.merchant_id)) return null;
  return escrow;
}

async function recordSafeguardingEntry(supabase: any, entry: any) {
  // Calculate running balance
  const { data: last } = await supabase
    .from('safeguarding_ledger')
    .select('running_balance')
    .eq('currency', entry.currency || 'XAF')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevBalance = last?.running_balance || 0;
  const newBalance = entry.direction === 'inflow'
    ? prevBalance + entry.amount
    : prevBalance - entry.amount;

  await supabase.from('safeguarding_ledger').insert({
    ...entry,
    running_balance: newBalance,
  });
}

// ─── Create Escrow ───
async function createEscrow(supabase: any, roleResult: any, req: Request, isAdmin: boolean) {
  const body = await req.json();
  const { merchant_id, parent_wallet_id, escrow_label, currency = 'XAF', metadata } = body;

  if (!merchant_id || !parent_wallet_id || !escrow_label) {
    return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id, parent_wallet_id, and escrow_label are required');
  }

  // Verify merchant access
  if (!isAdmin) {
    const merchantIds = await getMerchantIds(supabase, roleResult.userId!);
    if (!merchantIds.includes(merchant_id)) {
      return rfc7807('forbidden', 'Forbidden', 403, 'You do not own this merchant');
    }
  }

  // Verify parent wallet exists
  const { data: parentWallet } = await supabase.from('accounts').select('id').eq('id', parent_wallet_id).single();
  if (!parentWallet) return rfc7807('not_found', 'Not Found', 404, 'Parent wallet not found');

  const { data: escrow, error } = await supabase.from('escrow_wallets').insert({
    merchant_id,
    parent_wallet_id,
    escrow_label,
    currency,
    metadata: metadata || {},
  }).select().single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    action_type: 'escrow_wallet_created', entity_type: 'escrow_wallet', entity_id: escrow.id,
    performed_by: roleResult.userId, details: { merchant_id, escrow_label, currency },
  });

  return json(escrow, 201);
}

// ─── Get Escrow ───
async function getEscrow(supabase: any, roleResult: any, escrowId: string, isAdmin: boolean) {
  const escrow = await verifyEscrowAccess(supabase, escrowId, roleResult, isAdmin);
  if (!escrow) return rfc7807('not_found', 'Not Found', 404, 'Escrow wallet not found or access denied');
  return json(escrow);
}

// ─── List Escrows ───
async function listEscrows(supabase: any, roleResult: any, url: URL, isAdmin: boolean) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status');

  let query = supabase.from('escrow_wallets').select('*', { count: 'exact' });

  if (!isAdmin) {
    const merchantIds = await getMerchantIds(supabase, roleResult.userId!);
    if (merchantIds.length === 0) return json({ escrows: [], pagination: { total: 0, limit, offset } });
    query = query.in('merchant_id', merchantIds);
  }

  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count } = await query;
  return json({ escrows: data || [], pagination: { total: count, limit, offset } });
}

// ─── Fund Escrow ───
async function fundEscrow(supabase: any, roleResult: any, escrowId: string, req: Request, isAdmin: boolean) {
  const escrow = await verifyEscrowAccess(supabase, escrowId, roleResult, isAdmin);
  if (!escrow) return rfc7807('not_found', 'Not Found', 404, 'Escrow wallet not found');
  if (escrow.status !== 'active') return rfc7807('escrow_frozen', 'Escrow Not Active', 403, `Escrow is ${escrow.status}`);

  const body = await req.json();
  const { amount, reference, description } = body;
  if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be positive');

  // Debit parent wallet
  const { data: balance } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', escrow.parent_wallet_id)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  const available = balance?.amount || 0;
  if (available < amount) {
    return rfc7807('insufficient_funds', 'Insufficient Funds', 400, `Available: ${available}, Requested: ${amount}`);
  }

  const now = new Date().toISOString();

  // Debit parent
  await supabase.from('account_balances').update({
    amount: available - amount, balance_datetime: now,
  }).eq('id', balance.id);

  // Credit escrow
  await supabase.from('escrow_wallets').update({
    held_amount: escrow.held_amount + amount,
  }).eq('id', escrowId);

  // Record escrow transaction
  await supabase.from('escrow_transactions').insert({
    escrow_wallet_id: escrowId, transaction_type: 'fund', amount,
    currency: escrow.currency, reference, description, performed_by: roleResult.userId,
  });

  // Safeguarding ledger entry
  await recordSafeguardingEntry(supabase, {
    entry_type: 'client_receipt', direction: 'inflow', amount,
    currency: escrow.currency, merchant_id: escrow.merchant_id,
    escrow_wallet_id: escrowId, reference_type: 'escrow', reference_id: escrowId,
    description: `Escrow funded: ${description || reference || escrowId}`,
  });

  return json({
    escrow_id: escrowId,
    funded_amount: amount,
    total_held: escrow.held_amount + amount,
    parent_wallet_new_balance: available - amount,
  }, 201);
}

// ─── Release Escrow ───
async function releaseEscrow(supabase: any, roleResult: any, escrowId: string, req: Request) {
  const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('id', escrowId).single();
  if (!escrow) return rfc7807('not_found', 'Not Found', 404, 'Escrow not found');
  if (escrow.status === 'frozen') return rfc7807('escrow_frozen', 'Escrow Frozen', 403, 'Cannot release from frozen escrow');

  const body = await req.json();
  const { amount, recipient_wallet_id, description } = body;
  if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be positive');
  if (!recipient_wallet_id) return rfc7807('validation_error', 'Validation Error', 400, 'recipient_wallet_id is required');
  if (amount > escrow.held_amount - escrow.released_amount - escrow.refunded_amount) {
    return rfc7807('insufficient_escrow', 'Insufficient Escrow Balance', 400, 'Not enough held funds to release');
  }

  const now = new Date().toISOString();

  // Credit recipient wallet
  const { data: recipientBalance } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', recipient_wallet_id)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  if (recipientBalance) {
    await supabase.from('account_balances').update({
      amount: recipientBalance.amount + amount, balance_datetime: now,
    }).eq('id', recipientBalance.id);
  } else {
    await supabase.from('account_balances').insert({
      account_id: recipient_wallet_id, balance_type: 'ClosingAvailable', amount,
      currency: escrow.currency, credit_debit_indicator: 'Credit', balance_datetime: now,
    });
  }

  // Update escrow
  await supabase.from('escrow_wallets').update({
    released_amount: escrow.released_amount + amount,
  }).eq('id', escrowId);

  await supabase.from('escrow_transactions').insert({
    escrow_wallet_id: escrowId, transaction_type: 'release', amount,
    currency: escrow.currency, reference: recipient_wallet_id,
    description, performed_by: roleResult.userId,
  });

  await recordSafeguardingEntry(supabase, {
    entry_type: 'client_payout', direction: 'outflow', amount,
    currency: escrow.currency, merchant_id: escrow.merchant_id,
    escrow_wallet_id: escrowId, reference_type: 'escrow', reference_id: escrowId,
    description: `Escrow released to ${recipient_wallet_id}: ${description || ''}`,
  });

  return json({
    escrow_id: escrowId,
    released_amount: amount,
    total_released: escrow.released_amount + amount,
    remaining_held: escrow.held_amount - (escrow.released_amount + amount) - escrow.refunded_amount,
  });
}

// ─── Refund Escrow ───
async function refundEscrow(supabase: any, roleResult: any, escrowId: string, req: Request) {
  const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('id', escrowId).single();
  if (!escrow) return rfc7807('not_found', 'Not Found', 404, 'Escrow not found');

  const body = await req.json();
  const { amount, description } = body;
  if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be positive');

  const availableToRefund = escrow.held_amount - escrow.released_amount - escrow.refunded_amount;
  if (amount > availableToRefund) {
    return rfc7807('insufficient_escrow', 'Insufficient Escrow', 400, `Available to refund: ${availableToRefund}`);
  }

  const now = new Date().toISOString();

  // Credit back to parent wallet
  const { data: parentBalance } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', escrow.parent_wallet_id)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  if (parentBalance) {
    await supabase.from('account_balances').update({
      amount: parentBalance.amount + amount, balance_datetime: now,
    }).eq('id', parentBalance.id);
  }

  await supabase.from('escrow_wallets').update({
    refunded_amount: escrow.refunded_amount + amount,
  }).eq('id', escrowId);

  await supabase.from('escrow_transactions').insert({
    escrow_wallet_id: escrowId, transaction_type: 'refund', amount,
    currency: escrow.currency, description, performed_by: roleResult.userId,
  });

  await recordSafeguardingEntry(supabase, {
    entry_type: 'client_payout', direction: 'outflow', amount,
    currency: escrow.currency, merchant_id: escrow.merchant_id,
    escrow_wallet_id: escrowId, reference_type: 'escrow', reference_id: escrowId,
    description: `Escrow refunded to parent wallet: ${description || ''}`,
  });

  return json({
    escrow_id: escrowId,
    refunded_amount: amount,
    total_refunded: escrow.refunded_amount + amount,
    remaining_held: escrow.held_amount - escrow.released_amount - (escrow.refunded_amount + amount),
  });
}

// ─── Freeze/Unfreeze Escrow ───
async function freezeEscrow(supabase: any, roleResult: any, escrowId: string, req: Request) {
  const body = await req.json();
  const { freeze, reason } = body;
  if (typeof freeze !== 'boolean') return rfc7807('validation_error', 'Validation Error', 400, 'freeze must be boolean');

  const { data: escrow } = await supabase.from('escrow_wallets').select('id, status').eq('id', escrowId).single();
  if (!escrow) return rfc7807('not_found', 'Not Found', 404, 'Escrow not found');

  await supabase.from('escrow_wallets').update({
    status: freeze ? 'frozen' : 'active',
  }).eq('id', escrowId);

  await supabase.from('audit_logs').insert({
    action_type: freeze ? 'escrow_frozen' : 'escrow_unfrozen',
    entity_type: 'escrow_wallet', entity_id: escrowId,
    performed_by: roleResult.userId, details: { reason, previous_status: escrow.status },
  });

  return json({ escrow_id: escrowId, status: freeze ? 'frozen' : 'active', reason });
}

// ─── Escrow Transactions ───
async function getEscrowTransactions(supabase: any, roleResult: any, escrowId: string, url: URL, isAdmin: boolean) {
  const escrow = await verifyEscrowAccess(supabase, escrowId, roleResult, isAdmin);
  if (!escrow) return rfc7807('not_found', 'Not Found', 404, 'Escrow not found or access denied');

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const { data, count } = await supabase
    .from('escrow_transactions')
    .select('*', { count: 'exact' })
    .eq('escrow_wallet_id', escrowId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return json({ escrow_id: escrowId, transactions: data || [], pagination: { total: count, limit, offset } });
}
