// CrediQ — Consumer Premium Subscription
// ─────────────────────────────────────────────────────────────────
// Manages the 1,500 XAF / 30 day Premium plan that unlocks the full
// credit report, AI tips, monitoring alerts, and reminder emails.
//
// Actions:
//   - 'status'           → returns { active, period_end, auto_renew, plan }
//   - 'subscribe'        → creates an active 30-day subscription, records the fee
//   - 'cancel'           → flips auto_renew off (access remains until period_end)
//   - 'reactivate'       → re-enables auto_renew on an active sub
//
// Payment is settled by the caller via the wallet/gateway flow before
// invoking this. We only record the fee + extend the period.
// ─────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { corsHeaders } from "../_shared/cors.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";

const DEFAULT_PLAN_AMOUNT = 1500;
const DEFAULT_REPORT_AMOUNT = 2500;
const PLAN_CURRENCY = 'XAF';
const PERIOD_DAYS = 30;

// Resolve the admin-configured price from fee_structures. Falls back to the
// default constant if no active platform row is found.
async function resolveFeePrice(
  service: any,
  transactionType: string,
  fallback: number,
): Promise<number> {
  try {
    const nowIso = new Date().toISOString();
    const { data } = await service
      .from('fee_structures')
      .select('fixed_amount, fee_model, is_active, effective_from, effective_until, fee_scope')
      .eq('transaction_type', transactionType)
      .eq('is_active', true)
      .eq('fee_scope', 'platform')
      .lte('effective_from', nowIso)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return fallback;
    if (data.effective_until && new Date(data.effective_until) < new Date()) return fallback;
    const amt = Number(data.fixed_amount);
    return Number.isFinite(amt) && amt > 0 ? amt : fallback;
  } catch {
    return fallback;
  }
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Unauthorized', 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return jsonError('Unauthorized', 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case 'status':       return await handleStatus(service, userId);
      case 'subscribe':    return await handleSubscribe(service, userId, body);
      case 'cancel':       return await handleCancel(service, userId);
      case 'reactivate':   return await handleReactivate(service, userId);
      default: return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] crediq-subscription error:`, err);
    return jsonError('An internal error occurred.', 500, { error_id: errorId });
  }
});

async function handleStatus(service: any, userId: string) {
  const { data: sub } = await service
    .from('crediq_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  const active = !!sub && sub.status === 'active' && new Date(sub.current_period_end) > new Date();

  // Admin-configured pricing (source of truth) with sensible fallbacks.
  const [planAmount, reportAmount] = await Promise.all([
    resolveFeePrice(service, 'credit_premium_subscription', DEFAULT_PLAN_AMOUNT),
    resolveFeePrice(service, 'credit_report_inquiry', DEFAULT_REPORT_AMOUNT),
  ]);

  return jsonOk({
    active,
    plan: sub?.plan ?? 'free',
    status: sub?.status ?? 'none',
    auto_renew: sub?.auto_renew ?? false,
    current_period_start: sub?.current_period_start ?? null,
    current_period_end: sub?.current_period_end ?? null,
    amount: active && sub?.amount ? Number(sub.amount) : planAmount,
    currency: sub?.currency ?? PLAN_CURRENCY,
    period_days: PERIOD_DAYS,
    pricing: {
      plan_amount: planAmount,
      report_amount: reportAmount,
      currency: PLAN_CURRENCY,
      source: 'fee_structures',
    },
  });
}


async function handleSubscribe(service: any, userId: string, body: any) {
  // Admin-configured price is the source of truth.
  const PLAN_AMOUNT = await resolveFeePrice(service, 'credit_premium_subscription', DEFAULT_PLAN_AMOUNT);

  // ── Wallet debit (server-mediated) ──
  const { data: wallet, error: walletErr } = await service
    .from('accounts')
    .select('id, institution_id, currency')
    .eq('user_id', userId)
    .eq('account_type', 'wallet')
    .eq('is_active', true)
    .eq('currency', PLAN_CURRENCY)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (walletErr || !wallet) {
    return jsonError(
      'No active XAF wallet found. Please fund your wallet before activating Premium.',
      400,
      { code: 'wallet_missing' },
    );
  }

  const paymentRef = body.payment_reference || `crq-prem-${crypto.randomUUID().slice(0, 12)}`;
  const institutionId = body.institution_id || wallet.institution_id || null;

  // Atomic debit
  const { error: debitErr } = await service.rpc('atomic_debit_balance', {
    _account_id: wallet.id,
    _amount: PLAN_AMOUNT,
    _currency: PLAN_CURRENCY,
  });
  if (debitErr) {
    const msg = debitErr.message || 'Wallet debit failed';
    if (msg.toLowerCase().includes('insufficient')) {
      return jsonError(
        `Insufficient wallet balance for CrediQ Premium (${PLAN_AMOUNT.toLocaleString()} ${PLAN_CURRENCY}).`,
        402,
        { code: 'insufficient_funds', required: PLAN_AMOUNT, currency: PLAN_CURRENCY },
      );
    }
    return jsonError(msg, 400, { code: 'debit_failed' });
  }


  // Record the wallet transaction (best-effort)
  const nowIso = new Date().toISOString();
  await service.from('transactions').insert({
    account_id: wallet.id,
    amount: PLAN_AMOUNT,
    currency: PLAN_CURRENCY,
    credit_debit_indicator: 'Debit',
    status: 'Booked',
    booking_datetime: nowIso,
    value_datetime: nowIso,
    transaction_type: 'subscription_fee',
    transaction_information: 'CrediQ Premium subscription (30 days)',
    user_id: userId,
    metadata: { source: 'crediq_premium', plan: 'premium', payment_reference: paymentRef },
  });

  // Look for active sub
  const { data: existing } = await service
    .from('crediq_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  if (existing && new Date(existing.current_period_end) > now) {
    // Extend by another period
    periodStart = new Date(existing.current_period_end);
    periodEnd = new Date(periodStart.getTime() + PERIOD_DAYS * 86_400_000);
    await service.from('crediq_subscriptions').update({
      current_period_start: existing.current_period_start,
      current_period_end: periodEnd.toISOString(),
      auto_renew: true,
      status: 'active',
      last_charge_id: paymentRef,
    }).eq('id', existing.id);
  } else {
    periodStart = now;
    periodEnd = new Date(now.getTime() + PERIOD_DAYS * 86_400_000);

    if (existing) {
      await service.from('crediq_subscriptions').update({
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        auto_renew: true,
        last_charge_id: paymentRef,
      }).eq('id', existing.id);
    } else {
      await service.from('crediq_subscriptions').insert({
        user_id: userId,
        plan: 'premium',
        status: 'active',
        amount: PLAN_AMOUNT,
        currency: PLAN_CURRENCY,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        auto_renew: true,
        last_charge_id: paymentRef,
      });
    }
  }

  // Record the fee for billing/reporting
  await recordTransactionFee({
    supabase: service,
    institutionId,
    transactionType: 'credit_premium_subscription',
    transactionRef: paymentRef,
    transactionAmount: PLAN_AMOUNT,
    transactionCurrency: PLAN_CURRENCY,
    feeModel: 'fixed',
    calculatedFee: PLAN_AMOUNT,
    finalFee: PLAN_AMOUNT,
    feeBreakdown: { plan: 'premium', period_days: PERIOD_DAYS },
    metadata: { user_id: userId },
  });

  // Notify user
  await service.from('app_notifications').insert({
    user_id: userId,
    type: 'success',
    title: 'CrediQ Premium activated',
    message: `Welcome to CrediQ Premium. Your full report, AI tips and reminders are unlocked until ${periodEnd.toLocaleDateString()}.`,
    icon: 'credit',
    metadata: { period_end: periodEnd.toISOString() },
  });

  return jsonOk({
    success: true,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    amount: PLAN_AMOUNT,
    currency: PLAN_CURRENCY,
  });
}

async function handleCancel(service: any, userId: string) {
  const { data: sub } = await service
    .from('crediq_subscriptions')
    .select('id, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!sub) return jsonError('No active subscription to cancel', 404);

  await service.from('crediq_subscriptions').update({
    auto_renew: false,
    cancelled_at: new Date().toISOString(),
  }).eq('id', sub.id);

  return jsonOk({
    success: true,
    message: 'Auto-renew disabled. Premium remains active until the period ends.',
    period_end: sub.current_period_end,
  });
}

async function handleReactivate(service: any, userId: string) {
  const { data: sub } = await service
    .from('crediq_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!sub) return jsonError('No active subscription found', 404);

  await service.from('crediq_subscriptions').update({
    auto_renew: true,
    cancelled_at: null,
  }).eq('id', sub.id);

  return jsonOk({ success: true, message: 'Auto-renew re-enabled.' });
}

function jsonOk(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
