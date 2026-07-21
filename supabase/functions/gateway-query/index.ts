import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";
import {
  computeD2aFilterHash,
  computeD2aScopeHash,
  D2A_DEFAULT_LIMIT,
  D2A_MAX_LIMIT,
  decodeD2aCursor,
  finalizeD2aPage,
  parseD2aParams,
  type Env,
  type GatewayD2aOperation,
  type PaginationErrorProblem,
} from "./_pagination.ts";


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    const url = new URL(req.url);
    // Support action via body (POST) or query param (GET)
    let action: string;
    let bodyParams: any = {};
    if (req.method === 'POST') {
      bodyParams = await req.json();
      action = bodyParams.action;
    } else {
      action = url.searchParams.get('action') || '';
    }

    if (!action) return err('Missing action parameter', 400);

    const p = { ...bodyParams, url, user, supabase };

    switch (action) {
      // ─── LIST actions ───
      case 'list-charges': return await listCharges(p);
      case 'list-refunds': return await listSimple(p, 'gateway_refunds', 'list-refunds');
      case 'list-payouts': return await listPayouts(p);
      case 'list-settlements': return await listSimple(p, 'gateway_settlements', 'list-settlements');
      case 'list-disputes': return await listSimple(p, 'gateway_disputes', 'list-disputes');
      case 'list-beneficiaries': return await handleD2aList(p, { id: 'gatewayListBeneficiaries', table: 'gateway_beneficiaries' });
      case 'list-customers': return await executeD2bList(p, D2B_ROUTES['list-customers']);
      case 'list-customer-tokens': return await listCustomerTokens(p);
      case 'list-payment-links': return await handleD2aList(p, { id: 'gatewayListPaymentLinks', table: 'gateway_payment_links' });
      case 'list-payment-plans': return await executeD2bList(p, D2B_ROUTES['list-payment-plans']);
      case 'list-subaccounts': return await handleD2aList(p, { id: 'gatewayListSubaccounts', table: 'gateway_subaccounts' });
      case 'list-subscriptions': return await executeD2bList(p, D2B_ROUTES['list-subscriptions']);
      case 'list-virtual-accounts': return await handleD2aList(p, { id: 'gatewayListVirtualAccounts', table: 'gateway_virtual_accounts' });

      case 'list-funding-intents': return await listFundingIntents(p);
      case 'list-wallet-ledger': return await listWalletLedger(p);
      // ─── GET actions ───
      case 'get-charge': return await getCharge(p);
      case 'get-refund': return await getByIdWithMerchant(p, 'gateway_refunds', 'get-refund');
      case 'get-payout': return await getByIdWithMerchant(p, 'gateway_payouts', 'get-payout');
      case 'get-settlement': return await getSettlement(p);
      case 'get-dispute': return await getByIdWithMerchant(p, 'gateway_disputes', 'get-dispute');
      case 'get-customer': return await getCustomer(p);
      case 'get-payment-link': return await getPaymentLink(p);
      case 'get-payment-plan': return await getByIdWithMerchant(p, 'gateway_payment_plans', 'get-payment-plan', 'plan_id');
      case 'get-subaccount': return await getByIdWithMerchant(p, 'gateway_subaccounts', 'get-subaccount', 'subaccount_id');
      case 'get-subscription': return await getSubscription(p);
      case 'get-virtual-account': return await getByIdWithMerchant(p, 'gateway_virtual_accounts', 'get-virtual-account');
      case 'get-funding-intent': return await getFundingIntent(p);
      case 'get-payout-batch': return await getPayoutBatch(p);
      default: return err(`Unknown action: ${action}`, 400);
    }
  } catch (e) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-query error:`, e);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function ok(data: any) { return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function err(msg: string, status: number) { return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

function getParam(p: any, key: string) { return p[key] || p.url?.searchParams?.get(key); }
function getLimit(p: any, def = 50, max = 100) { return Math.min(parseInt(getParam(p, 'limit') || String(def)), max); }
function getOffset(p: any) { return parseInt(getParam(p, 'offset') || '0'); }

async function getMerchantIds(p: any): Promise<string[]> {
  const { data: merchants } = await p.supabase.from('gateway_merchants').select('id').eq('user_id', p.user.id);
  return merchants?.map((m: any) => m.id) || [];
}

async function verifyMerchant(p: any, merchantId: string) {
  const { data: merchant } = await p.supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', p.user.id).single();
  return merchant;
}

// ─── LIST helpers ───
async function listCharges(p: any) {
  const merchantIds = await getMerchantIds(p);
  if (merchantIds.length === 0) return ok({ data: [], total: 0 });
  const limit = getLimit(p); const offset = getOffset(p);
  const merchantId = getParam(p, 'merchant_id');
  const status = getParam(p, 'status');
  const channel = getParam(p, 'channel');
  const from = getParam(p, 'from');
  const to = getParam(p, 'to');
  let query = p.supabase.from('gateway_charges').select('*', { count: 'exact' });
  if (merchantId && merchantIds.includes(merchantId)) query = query.eq('merchant_id', merchantId);
  else query = query.in('merchant_id', merchantIds);
  if (status) query = query.eq('status', status);
  if (channel) query = query.eq('channel', channel);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return ok({ data, total: count, limit, offset });
}

async function listSimple(p: any, table: string, _label: string) {
  const merchantIds = await getMerchantIds(p);
  if (merchantIds.length === 0) return ok({ data: [], total: 0 });
  const limit = getLimit(p); const offset = getOffset(p);
  const { data, count, error } = await p.supabase.from(table).select('*', { count: 'exact' })
    .in('merchant_id', merchantIds).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return ok({ data, total: count, limit, offset });
}

async function listPayouts(p: any) {
  const merchantIds = await getMerchantIds(p);
  if (merchantIds.length === 0) return ok({ data: [], total: 0 });
  const limit = getLimit(p); const offset = getOffset(p);
  const merchantId = getParam(p, 'merchant_id');
  const status = getParam(p, 'status');
  let query = p.supabase.from('gateway_payouts').select('*', { count: 'exact' });
  if (merchantId && merchantIds.includes(merchantId)) query = query.eq('merchant_id', merchantId);
  else query = query.in('merchant_id', merchantIds);
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return ok({ data, total: count, limit, offset });
}

async function listBeneficiaries(p: any) {
  const merchantIds = await getMerchantIds(p);
  if (merchantIds.length === 0) return ok({ data: [], total: 0 });
  const limit = getLimit(p); const offset = getOffset(p);
  const merchantId = getParam(p, 'merchant_id');
  let query = p.supabase.from('gateway_beneficiaries').select('*', { count: 'exact' }).eq('is_active', true);
  if (merchantId && merchantIds.includes(merchantId)) query = query.eq('merchant_id', merchantId);
  else query = query.in('merchant_id', merchantIds);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return ok({ data, total: count, limit, offset });
}


async function listCustomerTokens(p: any) {
  const customer_id = getParam(p, 'customer_id');
  if (!customer_id) return err('customer_id required', 400);
  const { data: customer } = await p.supabase.from('gateway_customers').select('*, gateway_merchants!inner(user_id)').eq('id', customer_id).single();
  if (!customer || customer.gateway_merchants.user_id !== p.user.id) return err('not_found', 404);
  const { data: tokens, error } = await p.supabase.from('gateway_customer_tokens').select('*').eq('customer_id', customer_id).eq('is_active', true).order('created_at', { ascending: false });
  if (error) throw error;
  return ok({ data: tokens });
}


async function listMerchantResourceNoCount(p: any, table: string, _label: string) {
  const merchant_id = getParam(p, 'merchant_id');
  if (!merchant_id) return err('merchant_id required' , 400);
  if (!await verifyMerchant(p, merchant_id)) return err('merchant_not_found', 404);
  const { data, error } = await p.supabase.from(table).select('*').eq('merchant_id', merchant_id).order('created_at', { ascending: false });
  if (error) throw error;
  return ok({ data: data || [] });
}


async function listFundingIntents(p: any) {
  const accountId = getParam(p, 'account_id');
  const status = getParam(p, 'status');
  const from = getParam(p, 'from');
  const to = getParam(p, 'to');
  const limit = getLimit(p, 25); const offset = getOffset(p);
  let query = p.supabase.from('funding_intents').select('*', { count: 'exact' }).eq('user_id', p.user.id);
  if (accountId) query = query.eq('account_id', accountId);
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  return ok({ data: data || [], total: count || 0, limit, offset });
}

async function listWalletLedger(p: any) {
  const merchantId = getParam(p, 'merchant_id');
  const currency = getParam(p, 'currency') || 'XAF';
  if (!merchantId) return err('missing_merchant_id', 400);
  if (!await verifyMerchant(p, merchantId)) return err('merchant_not_found', 404);
  const limit = getLimit(p); const offset = getOffset(p);
  const ledger: any[] = [];
  const { data: charges } = await p.supabase.from('gateway_charges').select('id, amount, currency, status, created_at, tx_ref, metadata').eq('merchant_id', merchantId).eq('currency', currency).eq('status', 'successful').order('created_at', { ascending: false });
  charges?.forEach((c: any) => ledger.push({ id: c.id, type: 'charge', direction: 'credit', amount: c.amount, currency: c.currency, status: c.status, reference: c.tx_ref, created_at: c.created_at, metadata: c.metadata }));
  const { data: refunds } = await p.supabase.from('gateway_refunds').select('id, amount, currency, status, created_at, refund_ref, metadata').eq('merchant_id', merchantId).eq('currency', currency).eq('status', 'successful').order('created_at', { ascending: false });
  refunds?.forEach((r: any) => ledger.push({ id: r.id, type: 'refund', direction: 'debit', amount: r.amount, currency: r.currency, status: r.status, reference: r.refund_ref, created_at: r.created_at, metadata: r.metadata }));
  const { data: payouts } = await p.supabase.from('gateway_payouts').select('id, amount, currency, status, created_at, tx_ref, metadata').eq('merchant_id', merchantId).eq('currency', currency).in('status', ['successful', 'pending', 'processing']).order('created_at', { ascending: false });
  payouts?.forEach((px: any) => ledger.push({ id: px.id, type: 'payout', direction: 'debit', amount: px.amount, currency: px.currency, status: px.status, reference: px.tx_ref, created_at: px.created_at, metadata: px.metadata }));
  ledger.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return ok({ data: ledger.slice(offset, offset + limit), total: ledger.length, limit, offset });
}

// ─── GET helpers ───
async function getCharge(p: any) {
  const chargeId = getParam(p, 'id');
  if (!chargeId) return err('id is required', 400);
  const { data: charge, error } = await p.supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', chargeId).single();
  if (error || !charge) return err('charge_not_found', 404);
  if (charge.gateway_merchants.user_id !== p.user.id) return err('forbidden', 403);
  const { gateway_merchants, ...chargeData } = charge;
  return ok(chargeData);
}

async function getByIdWithMerchant(p: any, table: string, _label: string, idParam = 'id') {
  const id = getParam(p, idParam);
  if (!id) return err(`${idParam} is required`, 400);
  const { data: record } = await p.supabase.from(table).select('*, gateway_merchants!inner(user_id)').eq('id', id).single();
  if (!record || record.gateway_merchants.user_id !== p.user.id) return err('not_found', 404);
  const { gateway_merchants, ...rest } = record;
  return ok(rest);
}

async function getSettlement(p: any) {
  const settlementId = getParam(p, 'id');
  if (!settlementId) return err('id is required', 400);
  const { data: settlement } = await p.supabase.from('gateway_settlements').select('*, gateway_merchants!inner(user_id)').eq('id', settlementId).single();
  if (!settlement || settlement.gateway_merchants.user_id !== p.user.id) return err('not_found', 404);
  const { data: charges } = await p.supabase.from('gateway_charges')
    .select('id, amount, fee_amount, net_amount, status, channel, created_at')
    .eq('merchant_id', settlement.merchant_id).eq('status', 'successful')
    .gte('created_at', settlement.period_start).lte('created_at', settlement.period_end);
  const { gateway_merchants, ...settlementData } = settlement;
  return ok({ ...settlementData, line_items: charges || [] });
}

async function getCustomer(p: any) {
  const customer_id = getParam(p, 'customer_id');
  if (!customer_id) return err('customer_id required', 400);
  const { data: customer } = await p.supabase.from('gateway_customers').select('*, gateway_merchants!inner(user_id)').eq('id', customer_id).single();
  if (!customer || customer.gateway_merchants.user_id !== p.user.id) return err('not_found', 404);
  return ok(customer);
}

async function getPaymentLink(p: any) {
  const slug = getParam(p, 'slug');
  const id = getParam(p, 'id');
  if (!slug && !id) return err('slug or id required', 400);
  let query = p.supabase.from('gateway_payment_links').select('*, gateway_merchants(business_name, logo_url)');
  if (slug) query = query.eq('slug', slug); else query = query.eq('id', id);
  const { data: link, error } = await query.single();
  if (error || !link) return err('not_found', 404);
  if (link.status !== 'active') return err('link_inactive', 410);
  if (link.expires_at && new Date(link.expires_at) < new Date()) return err('link_expired', 410);
  if (link.max_uses && link.use_count >= link.max_uses) return err('link_exhausted', 410);
  return ok(link);
}

async function getSubscription(p: any) {
  const subscription_id = getParam(p, 'subscription_id');
  if (!subscription_id) return err('subscription_id required', 400);
  const { data: sub } = await p.supabase.from('gateway_subscriptions').select('*, gateway_payment_plans(*), gateway_merchants!inner(user_id)').eq('id', subscription_id).single();
  if (!sub || sub.gateway_merchants.user_id !== p.user.id) return err('not_found', 404);
  return ok(sub);
}

async function getFundingIntent(p: any) {
  const intentId = getParam(p, 'id');
  const accountId = getParam(p, 'account_id');
  if (!intentId) return err('missing_id', 400);
  let query = p.supabase.from('funding_intents').select('*').eq('id', intentId).eq('user_id', p.user.id);
  if (accountId) query = query.eq('account_id', accountId);
  const { data: intent, error } = await query.single();
  if (error || !intent) return err('not_found', 404);
  const { data: events } = await p.supabase.from('funding_events').select('*').eq('funding_intent_id', intent.id).order('created_at', { ascending: true });
  return ok({ ...intent, events: events || [] });
}

async function getPayoutBatch(p: any) {
  const batchId = getParam(p, 'id');
  if (!batchId) return err('id is required', 400);
  const { data: batch } = await p.supabase.from('gateway_payout_batches').select('*, gateway_merchants!inner(user_id)').eq('id', batchId).single();
  if (!batch || batch.gateway_merchants.user_id !== p.user.id) return err('not_found', 404);
  const { data: items } = await p.supabase.from('gateway_payouts').select('*').eq('batch_id', batchId).order('created_at', { ascending: true });
  const { gateway_merchants, ...batchData } = batch;
  return ok({ ...batchData, items: items || [] });
}

// ─── Phase 1B — R1I-d.2B: keyset pagination for three medium-volume gateway list ops ───
// Isolated d.2B block. MUST NOT alter or reach into the protected d.2A block
// that begins at the anchor comment below. Implements cursor pagination for
// gatewayListCustomers, gatewayListPaymentPlans and gatewayListSubscriptions
// via the accepted d.2B adapter. No d.2B code may appear after the d.2A anchor.
import {
  computeD2bFilterHash,
  computeD2bScopeHash,
  D2B_DEFAULT_LIMIT as _D2B_DEFAULT_LIMIT,
  D2B_MAX_LIMIT as _D2B_MAX_LIMIT,
  decodeD2bCursor,
  finalizeD2bPage,
  normalizeD2bSort,
  parseD2bParams,
  resolveD2bOperation,
  type D2bEnv,
  type D2bProblemDetails,
  type GatewayD2bOperationId,
} from "./_pagination-d2b.ts";
// Referencing constants so tree-shakers keep the accepted adapter surface.
void _D2B_DEFAULT_LIMIT;
void _D2B_MAX_LIMIT;

const D2B_PAGINATION_RESPONSE_HEADERS = [
  "X-Pagination-Mode",
  "X-Pagination-Has-More",
  "X-Pagination-Next-Cursor",
  "X-Pagination-Limit",
] as const;

const d2bCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Expose-Headers": D2B_PAGINATION_RESPONSE_HEADERS.join(", "),
};

type D2bRouteKey = "list-customers" | "list-payment-plans" | "list-subscriptions";

const D2B_ROUTES: Readonly<Record<D2bRouteKey, GatewayD2bOperationId>> = Object.freeze({
  "list-customers": "gatewayListCustomers",
  "list-payment-plans": "gatewayListPaymentPlans",
  "list-subscriptions": "gatewayListSubscriptions",
});

function detectD2bEnv(url?: URL): D2bEnv {
  const raw = (Deno.env.get('KOB_ENV') || Deno.env.get('SUPABASE_ENV') || '').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'sandbox' || raw === 'sbx') return 'sandbox';
  if (raw === 'test') return 'test';
  const host = (url?.hostname || '').toLowerCase();
  if (host.includes('sandbox')) return 'sandbox';
  return 'unknown';
}

function d2bProblemResponse(problem: D2bProblemDetails): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { ...d2bCorsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

function d2bErr(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...d2bCorsHeaders, 'Content-Type': 'application/json' },
  });
}

function d2bOk(payload: { body: unknown; headers: Record<string, string> }): Response {
  return new Response(JSON.stringify(payload.body), {
    status: 200,
    headers: { ...d2bCorsHeaders, 'Content-Type': 'application/json', ...payload.headers },
  });
}

function parseD2bOffset(raw: string | null | undefined):
  { ok: true; offset: number } | { ok: false; error: D2bProblemDetails } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, offset: 0 };
  const s = String(raw);
  if (!/^-?\d+$/.test(s)) {
    return {
      ok: false,
      error: {
        status: 400,
        type: "https://kob.dev/problems/pagination-offset-invalid",
        title: "Invalid pagination offset",
        detail: "offset must be a non-negative base-10 integer",
        code: "PAGINATION_LIMIT_INVALID",
      },
    };
  }
  const n = Number.parseInt(s, 10);
  if (!Number.isSafeInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
    return {
      ok: false,
      error: {
        status: 400,
        type: "https://kob.dev/problems/pagination-offset-invalid",
        title: "Invalid pagination offset",
        detail: "offset must be a safe non-negative integer",
        code: "PAGINATION_LIMIT_INVALID",
      },
    };
  }
  return { ok: true, offset: n };
}

async function handleD2bList(p: any, operationId: GatewayD2bOperationId): Promise<Response> {
  const op = resolveD2bOperation(operationId);
  const url: URL | undefined = p.url;
  const actorSub = String(p.user?.id || '');
  if (!actorSub) return d2bErr('unauthorized', 401);

  // Merchant boundary. Missing merchant_id → 400 (existing body semantics).
  // Foreign / unowned merchant → masked 404 via existing verifyMerchant().
  const rawMerchant = getParam(p, 'merchant_id');
  if (!rawMerchant) return d2bErr('merchant_id required', 400);
  if (!await verifyMerchant(p, rawMerchant)) return d2bErr('merchant_not_found', 404);
  const verifiedMerchantId = String(rawMerchant);

  // Limit + cursor parsing (canonical `cursor` parameter).
  const parsed = parseD2bParams({
    limit: getParam(p, 'limit'),
    cursor: getParam(p, 'cursor'),
  });
  if (!parsed.ok) return d2bProblemResponse(parsed.error);
  const { limit } = parsed.value;
  let cursor: string | null = parsed.value.cursor;

  // Sort normalisation — reject unsupported values with 400.
  const sortResult = normalizeD2bSort({
    sort_by: getParam(p, 'sort_by'),
    sort_order: getParam(p, 'sort_order'),
  });
  if (!sortResult.ok) return d2bProblemResponse(sortResult.error);
  const sort = sortResult.value;

  // Cursor precedence — cursor > kobp1-prefixed starting_after/ending_before.
  // Arbitrary DB ids in starting_after/ending_before are ignored, never
  // interpreted as unsigned cursors. Multiple distinct cursor-bearing values
  // fail closed with 400.
  const startingAfter = getParam(p, 'starting_after');
  const endingBefore = getParam(p, 'ending_before');
  const cursorSources: string[] = [];
  if (typeof cursor === 'string' && cursor.length > 0) cursorSources.push(cursor);
  if (typeof startingAfter === 'string' && startingAfter.startsWith('kobp1.')) {
    cursorSources.push(startingAfter);
  }
  if (typeof endingBefore === 'string' && endingBefore.startsWith('kobp1.')) {
    cursorSources.push(endingBefore);
  }
  if (cursorSources.length > 1) {
    return d2bProblemResponse({
      status: 400,
      type: "https://kob.dev/problems/pagination-cursor-conflict",
      title: "Conflicting cursor parameters",
      detail: "Only one of cursor, starting_after, ending_before may be supplied.",
      code: "PAGINATION_CURSOR_INVALID",
    });
  }
  cursor = cursorSources[0] ?? null;

  // Offset — only consulted when no cursor is accepted.
  const offsetResult = parseD2bOffset(getParam(p, 'offset'));
  if (!offsetResult.ok) return d2bProblemResponse(offsetResult.error);
  const offset = offsetResult.offset;

  // Operation-specific filter binding.
  const rawPlanId = operationId === 'gatewayListSubscriptions'
    ? getParam(p, 'plan_id') : null;
  const rawStatus = operationId === 'gatewayListSubscriptions'
    ? getParam(p, 'status') : null;
  const normPlanId = rawPlanId && String(rawPlanId).length > 0 ? String(rawPlanId) : null;
  const normStatus = rawStatus && String(rawStatus).length > 0 ? String(rawStatus) : null;

  // Cursor configuration errors from computeD2bScopeHash / decodeD2bCursor
  // must remain server 5xx — no try/catch converts them into client 400.
  const environment = detectD2bEnv(url);
  const scopeHash = await computeD2bScopeHash({
    environment,
    operation: operationId,
    actorSub,
    merchantId: verifiedMerchantId,
  });
  const filterHash = operationId === 'gatewayListSubscriptions'
    ? await computeD2bFilterHash({
        operation: 'gatewayListSubscriptions',
        planId: normPlanId,
        status: normStatus,
        sort,
      })
    : operationId === 'gatewayListPaymentPlans'
      ? await computeD2bFilterHash({ operation: 'gatewayListPaymentPlans', sort })
      : await computeD2bFilterHash({ operation: 'gatewayListCustomers', sort });

  let cursorPosition: { createdAt: string; id: string } | null = null;
  if (cursor) {
    const decoded = await decodeD2bCursor({
      token: cursor,
      operation: operationId,
      scopeHash,
      filterHash,
    });
    if (!decoded.ok) return d2bProblemResponse(decoded.error);
    cursorPosition = { createdAt: decoded.createdAt, id: decoded.id };
  }

  // Build keyset query. Every d.2B collection query applies the verified
  // merchant id via .eq("merchant_id", verifiedMerchantId).
  const select = operationId === 'gatewayListSubscriptions'
    ? '*, gateway_payment_plans(*)'
    : '*';
  let query = p.supabase.from(op.table).select(select).eq('merchant_id', verifiedMerchantId);
  if (operationId === 'gatewayListSubscriptions') {
    if (normPlanId) query = query.eq('plan_id', normPlanId);
    if (normStatus) query = query.eq('status', normStatus);
  }

  const mode: 'cursor' | 'hybrid' = cursorPosition
    ? 'cursor'
    : (offset > 0 ? 'hybrid' : 'cursor');

  if (cursorPosition) {
    // Safe PostgREST filter — strip characters that carry structural meaning
    // in `.or(...)` before interpolation. Position values are signed server
    // output but we still escape them defensively.
    const cAt = cursorPosition.createdAt.replace(/[(),]/g, '');
    const cId = cursorPosition.id.replace(/[(),]/g, '');
    query = query.or(
      `and(created_at.lt.${cAt}),and(created_at.eq.${cAt},id.lt.${cId})`,
    );
  }

  query = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (cursorPosition || offset === 0) {
    // Cursor accepted, or initial cursor-mode page: cursor precedence forbids
    // offset/range use when a cursor is present.
    query = query.limit(limit + 1);
  } else {
    // Hybrid initial page — `.range(from, to)` is inclusive, so `limit + 1`
    // rows correspond to endpoint `offset + limit`.
    query = query.range(offset, offset + limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data as Array<{ created_at: string; id: string }>) || [];

  const finalised = await finalizeD2bPage({
    operation: operationId,
    scopeHash,
    filterHash,
    limit,
    fetchedItems: rows,
    mode,
  });
  return d2bOk(finalised);
}

// ─── Phase 1B — R1I-d.2A: keyset pagination for four gateway list ops ───
// CI13 — explicit CORS exposure of the four d.2A pagination response headers
// on both success and error responses. This list is intentionally kept local
// to gateway-query so the repository-wide shared CORS helper is not modified.
const D2A_PAGINATION_RESPONSE_HEADERS = [
  "X-Pagination-Mode",
  "X-Pagination-Has-More",
  "X-Pagination-Next-Cursor",
  "X-Pagination-Limit",
] as const;

const d2aCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Expose-Headers": D2A_PAGINATION_RESPONSE_HEADERS.join(", "),
};

function detectEnv(url?: URL): Env {
  const raw = (Deno.env.get('KOB_ENV') || Deno.env.get('SUPABASE_ENV') || '').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'sandbox' || raw === 'sbx') return 'sandbox';
  if (raw === 'test') return 'test';
  const host = (url?.hostname || '').toLowerCase();
  if (host.includes('sandbox')) return 'sandbox';
  return 'unknown';
}


function d2aErrorResponse(err: PaginationErrorProblem): Response {
  return new Response(JSON.stringify(err), {
    status: err.status,
    headers: { ...d2aCorsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

function d2aOk<T>(payload: { body: unknown; headers: Record<string, string> }): Response {
  return new Response(JSON.stringify(payload.body), {
    status: 200,
    headers: { ...d2aCorsHeaders, 'Content-Type': 'application/json', ...payload.headers },
  });
}

function d2aEmptyPayload(limit: number) {
  return {
    body: {
      data: [],
      pagination: { mode: 'cursor' as const, has_more: false, next_cursor: null, limit },
    },
    headers: {
      'X-Pagination-Mode': 'cursor',
      'X-Pagination-Has-More': 'false',
      'X-Pagination-Limit': String(limit),
    } as Record<string, string>,
  };
}

async function handleD2aList(p: any, op: GatewayD2aOperation): Promise<Response> {
  const environment = detectEnv(p.url as URL | undefined);
  const actorSub = String(p.user?.id || '');
  if (!actorSub) return err('unauthorized', 401);

  // Parse ratified pagination parameters first so that limit validation
  // (invalid → 400 Problem Details) applies uniformly, and empty-scope
  // responses can echo the client-validated limit rather than defaulting.
  const parsed = parseD2aParams({
    limit: getParam(p, 'limit'),
    cursor: getParam(p, 'cursor'),
  });
  if (!parsed.ok) return d2aErrorResponse(parsed.error);
  const { limit, cursor } = parsed.value;

  // Resolve authoritative merchant scope for this actor. Client-supplied
  // merchant_id is only honoured if it belongs to the authenticated actor.
  const requestedMerchantId = getParam(p, 'merchant_id') || null;
  const merchantIds = await getMerchantIds(p);
  let merchantScope: string[];
  if (requestedMerchantId) {
    if (!merchantIds.includes(requestedMerchantId)) {
      // Never disclose whether an unrelated merchant exists. Emit the full
      // ratified d.2A response contract (headers + body) with empty data.
      return d2aOk(d2aEmptyPayload(limit));
    }
    merchantScope = [requestedMerchantId];
  } else {
    merchantScope = merchantIds;
  }
  if (merchantScope.length === 0) {
    return d2aOk(d2aEmptyPayload(limit));
  }

  // Operation-specific filter binding — must remain in sync with per-operation
  // ratified filter surface (d.2S contract-decisions §1).
  const filters: Record<string, unknown> = {};
  if (op.id === 'gatewayListPaymentLinks') {
    const slug = getParam(p, 'slug');
    if (slug) filters.slug = String(slug);
  }
  if (op.id === 'gatewayListVirtualAccounts') {
    const accountKind = getParam(p, 'account_kind');
    if (accountKind) filters.account_kind = String(accountKind);
  }
  if (op.id === 'gatewayListBeneficiaries') {
    filters.is_active = true;
  }

  const scopeHash = await computeD2aScopeHash({
    environment,
    operation: op.id,
    actorSub,
    merchantScope,
  });
  const filterHash = await computeD2aFilterHash(filters);

  let cursorPosition: { createdAt: string; id: string } | null = null;
  if (cursor) {
    const decoded = await decodeD2aCursor(cursor, {
      operation: op.id,
      scopeHash,
      filterHash,
    });
    if (!decoded.ok) return d2aErrorResponse(decoded.error);
    cursorPosition = { createdAt: decoded.createdAt, id: decoded.id };
  }

  // Build scoped keyset query.
  let query = p.supabase.from(op.table).select('*');
  if (merchantScope.length === 1) {
    query = query.eq('merchant_id', merchantScope[0]);
  } else {
    query = query.in('merchant_id', merchantScope);
  }
  if (op.id === 'gatewayListBeneficiaries') query = query.eq('is_active', true);
  if (op.id === 'gatewayListPaymentLinks' && filters.slug) query = query.eq('slug', filters.slug);
  if (op.id === 'gatewayListVirtualAccounts' && filters.account_kind) query = query.eq('account_kind', filters.account_kind);

  if (cursorPosition) {
    const c = cursorPosition;
    query = query.or(
      `and(created_at.lt.${c.createdAt}),and(created_at.eq.${c.createdAt},id.lt.${c.id})`,
    );
  }

  query = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data as Array<{ created_at: string; id: string }>) || [];
  const finalised = await finalizeD2aPage({
    operation: op.id,
    scopeHash,
    filterHash,
    limit,
    fetchedItems: rows,
  });
  return d2aOk(finalised);
}

