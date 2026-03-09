import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateUserRole } from "../_shared/role-middleware.ts";

import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Admin-only endpoint
  const roleResult = await validateUserRole(req, ['admin']);
  if (!roleResult.valid) {
    return rfc7807('unauthorized', 'Unauthorized', roleResult.error === 'Missing authorization header' ? 401 : 403, roleResult.error!);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const action = pathParts[1] || null;

  try {
    // GET / — Ledger summary (total safeguarded amounts by currency)
    if (req.method === 'GET' && !action) {
      return await getLedgerSummary(supabase, url);
    }

    // GET /entries — Paginated ledger entries
    if (req.method === 'GET' && action === 'entries') {
      return await getLedgerEntries(supabase, url);
    }

    // GET /reconciliation — Reconciliation report
    if (req.method === 'GET' && action === 'reconciliation') {
      return await getReconciliationReport(supabase, url);
    }

    // POST /reconcile — Mark entries as reconciled
    if (req.method === 'POST' && action === 'reconcile') {
      return await reconcileEntries(supabase, roleResult, req);
    }

    // POST /adjustment — Manual regulatory adjustment
    if (req.method === 'POST' && action === 'adjustment') {
      return await createAdjustment(supabase, roleResult, req);
    }

    return rfc7807('not_found', 'Not Found', 404, `Route not matched: ${req.method} ${url.pathname}`);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-safeguarding-ledger] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});

// ─── Ledger Summary ───
async function getLedgerSummary(supabase: any, url: URL) {
  const currency = url.searchParams.get('currency') || 'XAF';

  // Get latest running balance
  const { data: latestEntry } = await supabase
    .from('safeguarding_ledger')
    .select('running_balance, created_at')
    .eq('currency', currency)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get totals by entry_type
  const { data: entries } = await supabase
    .from('safeguarding_ledger')
    .select('entry_type, direction, amount')
    .eq('currency', currency);

  const totals: Record<string, { inflow: number; outflow: number }> = {};
  for (const e of entries || []) {
    if (!totals[e.entry_type]) totals[e.entry_type] = { inflow: 0, outflow: 0 };
    totals[e.entry_type][e.direction as 'inflow' | 'outflow'] += Number(e.amount);
  }

  // Get total unreconciled
  const { count: unreconciledCount } = await supabase
    .from('safeguarding_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('currency', currency)
    .eq('reconciled', false);

  // Get total escrow held
  const { data: escrowTotals } = await supabase
    .from('escrow_wallets')
    .select('held_amount, released_amount, refunded_amount')
    .eq('currency', currency)
    .eq('status', 'active');

  const totalEscrowHeld = (escrowTotals || []).reduce(
    (sum: number, e: any) => sum + (e.held_amount - e.released_amount - e.refunded_amount), 0
  );

  return json({
    currency,
    safeguarded_balance: latestEntry?.running_balance || 0,
    as_of: latestEntry?.created_at || null,
    total_escrow_held: totalEscrowHeld,
    unreconciled_entries: unreconciledCount || 0,
    breakdown: totals,
  });
}

// ─── Ledger Entries ───
async function getLedgerEntries(supabase: any, url: URL) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const currency = url.searchParams.get('currency');
  const entryType = url.searchParams.get('entry_type');
  const reconciled = url.searchParams.get('reconciled');
  const merchantId = url.searchParams.get('merchant_id');

  let query = supabase.from('safeguarding_ledger').select('*', { count: 'exact' });

  if (currency) query = query.eq('currency', currency);
  if (entryType) query = query.eq('entry_type', entryType);
  if (reconciled !== null && reconciled !== undefined) query = query.eq('reconciled', reconciled === 'true');
  if (merchantId) query = query.eq('merchant_id', merchantId);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count } = await query;
  return json({ entries: data || [], pagination: { total: count, limit, offset } });
}

// ─── Reconciliation Report ───
async function getReconciliationReport(supabase: any, url: URL) {
  const currency = url.searchParams.get('currency') || 'XAF';

  // Total safeguarded per ledger
  const { data: latestEntry } = await supabase
    .from('safeguarding_ledger')
    .select('running_balance')
    .eq('currency', currency)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Total wallet balances (actual customer funds held)
  const { data: walletBalances } = await supabase
    .from('account_balances')
    .select('amount')
    .eq('balance_type', 'ClosingAvailable')
    .eq('currency', currency)
    .eq('credit_debit_indicator', 'Credit');

  const totalWalletFunds = (walletBalances || []).reduce((sum: number, b: any) => sum + Number(b.amount), 0);

  // Escrow held
  const { data: escrows } = await supabase
    .from('escrow_wallets')
    .select('held_amount, released_amount, refunded_amount')
    .eq('currency', currency)
    .neq('status', 'closed');

  const totalEscrow = (escrows || []).reduce(
    (sum: number, e: any) => sum + (e.held_amount - e.released_amount - e.refunded_amount), 0
  );

  // Treasury float
  const { data: floatData } = await supabase
    .from('treasury_float')
    .select('available_balance')
    .eq('currency', currency)
    .maybeSingle();

  const ledgerBalance = latestEntry?.running_balance || 0;
  const actualFunds = totalWalletFunds + totalEscrow;
  const discrepancy = ledgerBalance - actualFunds;

  return json({
    currency,
    ledger_safeguarded_balance: ledgerBalance,
    actual_customer_funds: {
      wallet_balances: totalWalletFunds,
      escrow_held: totalEscrow,
      total: actualFunds,
    },
    treasury_float: floatData?.available_balance || 0,
    discrepancy,
    status: Math.abs(discrepancy) < 1 ? 'balanced' : discrepancy > 0 ? 'over_safeguarded' : 'under_safeguarded',
    generated_at: new Date().toISOString(),
  });
}

// ─── Reconcile Entries ───
async function reconcileEntries(supabase: any, roleResult: any, req: Request) {
  const body = await req.json();
  const { entry_ids } = body;
  if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
    return rfc7807('validation_error', 'Validation Error', 400, 'entry_ids array is required');
  }

  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from('safeguarding_ledger')
    .update({ reconciled: true, reconciled_at: now, reconciled_by: roleResult.userId })
    .in('id', entry_ids)
    .eq('reconciled', false);

  if (error) throw error;

  return json({ reconciled_count: count || entry_ids.length, reconciled_at: now });
}

// ─── Manual Adjustment ───
async function createAdjustment(supabase: any, roleResult: any, req: Request) {
  const body = await req.json();
  const { amount, currency = 'XAF', direction, description, merchant_id } = body;

  if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be positive');
  if (!['inflow', 'outflow'].includes(direction)) return rfc7807('validation_error', 'Validation Error', 400, 'direction must be inflow or outflow');
  if (!description) return rfc7807('validation_error', 'Validation Error', 400, 'description is required');

  // Calculate running balance
  const { data: last } = await supabase
    .from('safeguarding_ledger')
    .select('running_balance')
    .eq('currency', currency)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevBalance = last?.running_balance || 0;
  const newBalance = direction === 'inflow' ? prevBalance + amount : prevBalance - amount;

  const { data: entry, error } = await supabase.from('safeguarding_ledger').insert({
    entry_type: 'reconciliation_adjustment',
    direction,
    amount,
    currency,
    running_balance: newBalance,
    merchant_id: merchant_id || null,
    reference_type: 'manual',
    description,
  }).select().single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    action_type: 'safeguarding_adjustment', entity_type: 'safeguarding_ledger', entity_id: entry.id,
    performed_by: roleResult.userId, details: { amount, direction, description },
  });

  return json(entry, 201);
}
