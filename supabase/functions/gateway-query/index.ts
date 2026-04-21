import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

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
      case 'list-beneficiaries': return await listBeneficiaries(p);
      case 'list-customers': return await listCustomers(p);
      case 'list-customer-tokens': return await listCustomerTokens(p);
      case 'list-payment-links': return await listMerchantResource(p, 'gateway_payment_links', 'list-payment-links');
      case 'list-payment-plans': return await listMerchantResource(p, 'gateway_payment_plans', 'list-payment-plans');
      case 'list-subaccounts': return await listMerchantResourceNoCount(p, 'gateway_subaccounts', 'list-subaccounts');
      case 'list-subscriptions': return await listSubscriptions(p);
      case 'list-virtual-accounts': return await listMerchantResourceNoCount(p, 'gateway_virtual_accounts', 'list-virtual-accounts');
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

async function listCustomers(p: any) {
  const merchant_id = getParam(p, 'merchant_id');
  if (!merchant_id) return err('merchant_id required', 400);
  if (!await verifyMerchant(p, merchant_id)) return err('merchant_not_found', 404);
  const limit = getLimit(p, 20); const offset = getOffset(p);
  const { data, error, count } = await p.supabase.from('gateway_customers').select('*', { count: 'exact' })
    .eq('merchant_id', merchant_id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
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

async function listMerchantResource(p: any, table: string, _label: string) {
  const merchant_id = getParam(p, 'merchant_id');
  if (!merchant_id) return err('merchant_id required', 400);
  if (!await verifyMerchant(p, merchant_id)) return err('merchant_not_found', 404);
  const limit = getLimit(p, 20); const offset = getOffset(p);
  const { data, error, count } = await p.supabase.from(table).select('*', { count: 'exact' })
    .eq('merchant_id', merchant_id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return ok({ data, total: count, limit, offset });
}

async function listMerchantResourceNoCount(p: any, table: string, _label: string) {
  const merchant_id = getParam(p, 'merchant_id');
  if (!merchant_id) return err('merchant_id required' , 400);
  if (!await verifyMerchant(p, merchant_id)) return err('merchant_not_found', 404);
  const { data, error } = await p.supabase.from(table).select('*').eq('merchant_id', merchant_id).order('created_at', { ascending: false });
  if (error) throw error;
  return ok({ data: data || [] });
}

async function listSubscriptions(p: any) {
  const merchant_id = getParam(p, 'merchant_id');
  if (!merchant_id) return err('merchant_id required', 400);
  if (!await verifyMerchant(p, merchant_id)) return err('merchant_not_found', 404);
  const limit = getLimit(p, 20); const offset = getOffset(p);
  const status = getParam(p, 'status');
  let query = p.supabase.from('gateway_subscriptions').select('*, gateway_payment_plans(*)', { count: 'exact' })
    .eq('merchant_id', merchant_id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) throw error;
  return ok({ data, total: count, limit, offset });
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
