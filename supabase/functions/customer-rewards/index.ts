// Customer Rewards Engine
// Actions: award_cashback, link_referral, complete_referral, list_coupons, redeem_coupon, get_summary

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Body {
  action: string;
  // award_cashback
  user_id?: string;
  transaction_id?: string;
  amount?: number;
  // link_referral
  referral_code?: string;
  // complete_referral
  triggering_user_id?: string;
  // redeem_coupon
  code?: string;
  order_amount?: number;
}

async function getConfig(supabase: any, key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from('system_config').select('value').eq('key', key).maybeSingle();
  if (!data) return fallback;
  try {
    const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  } catch {
    const n = Number(data.value);
    return isFinite(n) ? n : fallback;
  }
}

async function getUserPrimaryAccount(supabase: any, userId: string) {
  const { data } = await supabase.from('accounts').select('id, currency')
    .eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle();
  return data;
}

async function creditWallet(supabase: any, accountId: string, amount: number, currency = 'XAF') {
  const { data, error } = await supabase.rpc('atomic_credit_balance', {
    _account_id: accountId, _amount: amount, _currency: currency,
  });
  if (error) throw new Error(`Wallet credit failed: ${error.message}`);
  return data;
}

async function recordTransaction(supabase: any, userId: string, accountId: string, amount: number, description: string, ref: string, currency = 'XAF') {
  await supabase.from('transactions').insert({
    user_id: userId,
    account_id: accountId,
    institution_id: '00000000-0000-0000-0000-000000000000',
    credit_debit_indicator: 'Credit',
    status: 'Booked',
    booking_datetime: new Date().toISOString(),
    value_datetime: new Date().toISOString(),
    transaction_type: 'reward',
    amount,
    currency,
    transaction_information: description,
    merchant_details: { reward_ref: ref },
  });
}

// ============== ACTIONS ==============

async function awardCashback(supabase: any, body: Body) {
  const { user_id, transaction_id, amount } = body;
  if (!user_id || !transaction_id || !amount || amount <= 0) {
    return { error: 'user_id, transaction_id, amount required' };
  }

  const minTransfer = await getConfig(supabase, 'cashback_min_transfer', 100000);
  const rate = await getConfig(supabase, 'cashback_rate', 1);

  if (amount < minTransfer) {
    return { eligible: false, reason: 'below_minimum', min: minTransfer };
  }

  const cashback = Math.floor((amount * rate) / 100);
  if (cashback <= 0) return { eligible: false, reason: 'zero_cashback' };

  // Idempotent insert (unique on user_id+reward_type+reference_id)
  const { data: existing } = await supabase.from('customer_rewards')
    .select('id').eq('user_id', user_id).eq('reward_type', 'cashback')
    .eq('reference_id', transaction_id).maybeSingle();
  if (existing) return { eligible: true, already_awarded: true, cashback };

  const acct = await getUserPrimaryAccount(supabase, user_id);
  if (!acct) return { error: 'no_active_account' };

  const { error: insErr } = await supabase.from('customer_rewards').insert({
    user_id,
    reward_type: 'cashback',
    amount: cashback,
    currency: acct.currency || 'XAF',
    status: 'credited',
    description: `${rate}% cashback on transfer of ${amount.toLocaleString()} ${acct.currency || 'XAF'}`,
    reference_id: transaction_id,
    metadata: { transfer_amount: amount, rate, min_transfer: minTransfer },
  });
  if (insErr && !insErr.message.includes('duplicate')) throw insErr;
  if (insErr) return { eligible: true, already_awarded: true };

  await creditWallet(supabase, acct.id, cashback, acct.currency || 'XAF');
  await recordTransaction(supabase, user_id, acct.id, cashback, `Cashback reward`, `cashback-${transaction_id}`, acct.currency || 'XAF');

  await supabase.from('app_notifications').insert({
    user_id, type: 'success', title: 'Cashback Earned',
    message: `You earned ${cashback.toLocaleString()} ${acct.currency || 'XAF'} cashback on your transfer.`,
    icon: 'gift', metadata: { cashback, transaction_id },
  });

  return { eligible: true, awarded: true, cashback };
}

async function linkReferral(supabase: any, body: Body, authedUserId: string) {
  const { referral_code } = body;
  if (!referral_code) return { error: 'referral_code required' };

  // Find referrer by stable code
  const { data: referrer } = await supabase.from('profiles')
    .select('id').eq('referral_code', referral_code.toUpperCase().trim()).maybeSingle();
  if (!referrer) return { error: 'invalid_referral_code' };
  if (referrer.id === authedUserId) return { error: 'self_referral_not_allowed' };

  // Check if already referred
  const { data: existing } = await supabase.from('customer_referrals')
    .select('id, status').eq('referred_id', authedUserId).maybeSingle();
  if (existing) return { already_linked: true, status: existing.status };

  const bonus = await getConfig(supabase, 'referral_bonus_amount', 500);

  const { data: ref, error } = await supabase.from('customer_referrals').insert({
    referrer_id: referrer.id,
    referred_id: authedUserId,
    referral_code: referral_code.toUpperCase().trim(),
    bonus_amount: bonus,
    status: 'pending',
  }).select('id').single();
  if (error) throw error;

  return { linked: true, referral_id: ref.id, bonus_amount: bonus };
}

async function completeReferral(supabase: any, body: Body) {
  const { triggering_user_id } = body;
  if (!triggering_user_id) return { error: 'triggering_user_id required' };

  const { data: ref } = await supabase.from('customer_referrals')
    .select('*').eq('referred_id', triggering_user_id).eq('status', 'pending').maybeSingle();
  if (!ref) return { completed: false, reason: 'no_pending_referral' };

  // Mark complete
  await supabase.from('customer_referrals').update({
    status: 'completed', completed_at: new Date().toISOString(),
  }).eq('id', ref.id);

  // Credit bonus to BOTH parties
  for (const userId of [ref.referrer_id, ref.referred_id]) {
    const acct = await getUserPrimaryAccount(supabase, userId);
    if (!acct) continue;

    const refId = `ref-${ref.id}-${userId === ref.referrer_id ? 'referrer' : 'referred'}`;

    const { error: insErr } = await supabase.from('customer_rewards').insert({
      user_id: userId,
      reward_type: 'referral_bonus',
      amount: ref.bonus_amount,
      currency: acct.currency || 'XAF',
      status: 'credited',
      description: userId === ref.referrer_id ? 'Referral bonus — friend joined' : 'Welcome bonus — referred signup',
      reference_id: refId,
      metadata: { referral_id: ref.id, role: userId === ref.referrer_id ? 'referrer' : 'referred' },
    });
    if (insErr && insErr.message.includes('duplicate')) continue;
    if (insErr) { console.error('reward insert err', insErr); continue; }

    await creditWallet(supabase, acct.id, ref.bonus_amount, acct.currency || 'XAF');
    await recordTransaction(supabase, userId, acct.id, ref.bonus_amount, 'Referral bonus', refId, acct.currency || 'XAF');

    await supabase.from('app_notifications').insert({
      user_id: userId, type: 'success', title: 'Referral Bonus Credited',
      message: `${ref.bonus_amount.toLocaleString()} ${acct.currency || 'XAF'} referral bonus added to your wallet.`,
      icon: 'gift', metadata: { referral_id: ref.id },
    });
  }

  return { completed: true, bonus_amount: ref.bonus_amount };
}

async function listCoupons(supabase: any) {
  const { data, error } = await supabase.from('pos_coupons')
    .select('id, code, type, value, min_order_amount, expires_at, merchant_id')
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .limit(50);
  if (error) throw error;

  // Enrich with merchant name
  const merchantIds = [...new Set((data || []).map((c: any) => c.merchant_id))];
  const { data: merchants } = await supabase.from('gateway_merchants')
    .select('id, business_name').in('id', merchantIds);
  const mMap = new Map((merchants || []).map((m: any) => [m.id, m.business_name]));

  return {
    coupons: (data || []).map((c: any) => ({
      ...c, merchant_name: mMap.get(c.merchant_id) || 'Merchant',
    })),
  };
}

async function getSummary(supabase: any, userId: string) {
  const { data: rewards } = await supabase.from('customer_rewards')
    .select('reward_type, amount').eq('user_id', userId);
  const totals: Record<string, number> = { cashback: 0, referral_bonus: 0, total: 0 };
  (rewards || []).forEach((r: any) => {
    totals[r.reward_type] = (totals[r.reward_type] || 0) + Number(r.amount || 0);
    totals.total += Number(r.amount || 0);
  });
  const { data: profile } = await supabase.from('profiles').select('referral_code').eq('id', userId).maybeSingle();
  const { count: referralsCount } = await supabase.from('customer_referrals')
    .select('*', { count: 'exact', head: true }).eq('referrer_id', userId);
  return { totals, referral_code: profile?.referral_code, referrals_count: referralsCount || 0 };
}

// ============== ENTRY ==============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as Body;
    const action = body.action;
    if (!action) return new Response(JSON.stringify({ error: 'action required' }), { status: 400, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, serviceKey);

    // For user-initiated actions, validate JWT
    let authedUserId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) authedUserId = user.id;
    }

    let result: any;
    switch (action) {
      case 'award_cashback':
        // Service-only (called by api-transfers internally)
        result = await awardCashback(supabase, body);
        break;
      case 'link_referral':
        if (!authedUserId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
        result = await linkReferral(supabase, body, authedUserId);
        break;
      case 'complete_referral':
        result = await completeReferral(supabase, body);
        break;
      case 'list_coupons':
        result = await listCoupons(supabase);
        break;
      case 'get_summary':
        if (!authedUserId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
        result = await getSummary(supabase, authedUserId);
        break;
      default:
        return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify(result), {
      status: result?.error ? 400 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('customer-rewards error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
