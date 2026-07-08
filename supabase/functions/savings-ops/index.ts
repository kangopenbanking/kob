// Consolidated router for savings operations: create, deposit, withdraw, accrue-interest
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendManagedEmail, getUserName } from '../_shared/send-managed-email.ts';
import { notifyAdmins } from '../_shared/admin-notify.ts';
import { recordAuditEvent } from '../_shared/audit-trail.ts';

// Anomaly threshold (XAF) — withdrawals at/above this fire an admin alert.
const SAVINGS_ANOMALY_THRESHOLD_XAF = 500_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    switch (action) {
      case 'create': return handleCreate(req, body);
      case 'deposit': return handleDeposit(req, body);
      case 'withdraw': return handleWithdraw(req, body);
      case 'accrue-interest': return handleAccrueInterest(req, body);
      default: return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    console.error('savings-ops error:', err);
    return new Response(JSON.stringify({ error: err.message || 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function getUserClient(req: Request) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function handleCreate(req: Request, body: any) {
  const supabase = getUserClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { product_id, account_name, opening_deposit, target_amount, target_date, auto_save_settings, institution_id } = body;
  const { data: product, error: productError } = await supabase.from('savings_products').select('*').eq('id', product_id).single();
  if (productError || !product) throw new Error('Invalid savings product');
  if (opening_deposit < product.min_opening_balance) throw new Error(`Minimum opening balance is ${product.min_opening_balance} XAF`);

  const { data: accountData, error: accountError } = await supabase.from('accounts').insert({ user_id: user.id, account_type: 'Personal', account_subtype: 'Savings', account_holder_name: user.email, nickname: account_name, identification_scheme: 'LOCAL_BANK', identification_value: `SAV-${Date.now()}`, account_id: `SAV-${Date.now()}`, currency: 'XAF', is_active: true }).select().single();
  if (accountError || !accountData) throw new Error('Failed to create account');

  let maturityDate = null, isLocked = false;
  if (product.lock_in_period_months) { maturityDate = new Date(); maturityDate.setMonth(maturityDate.getMonth() + product.lock_in_period_months); isLocked = true; }

  const nextInterestDate = new Date();
  if (product.interest_payment_frequency === 'monthly') nextInterestDate.setMonth(nextInterestDate.getMonth() + 1);
  else if (product.interest_payment_frequency === 'quarterly') nextInterestDate.setMonth(nextInterestDate.getMonth() + 3);
  else if (product.interest_payment_frequency === 'annually') nextInterestDate.setFullYear(nextInterestDate.getFullYear() + 1);
  else nextInterestDate.setTime(maturityDate?.getTime() || Date.now());

  const { data: savingsAccount, error: savingsError } = await supabase.from('savings_accounts').insert({ account_id: accountData.id, user_id: user.id, product_id: product.id, savings_type: product.savings_type, account_name, institution_id: institution_id || null, target_amount, target_date, auto_save_enabled: auto_save_settings?.enabled || false, auto_save_amount: auto_save_settings?.amount || null, auto_save_frequency: auto_save_settings?.frequency || null, auto_save_day: auto_save_settings?.day || null, current_balance: opening_deposit, available_balance: isLocked ? 0 : opening_deposit, current_interest_rate: product.base_interest_rate, next_interest_date: nextInterestDate.toISOString().split('T')[0], maturity_date: maturityDate?.toISOString().split('T')[0], is_locked: isLocked, status: 'active' }).select().single();
  if (savingsError || !savingsAccount) { await supabase.from('accounts').delete().eq('id', accountData.id); throw new Error('Failed to create savings account'); }

  await supabase.from('savings_transactions').insert({ savings_account_id: savingsAccount.id, user_id: user.id, transaction_type: 'deposit', amount: opening_deposit, balance_after: opening_deposit, description: 'Opening deposit', reference: `OPEN-${Date.now()}` });
  await supabase.from('account_balances').insert({ account_id: accountData.id, balance_type: 'InterimAvailable', credit_debit_indicator: 'Credit', amount: opening_deposit, currency: 'XAF', balance_datetime: new Date().toISOString() });

  await recordAuditEvent({
    action_type: 'savings_account_created',
    entity_type: 'savings_account',
    entity_id: savingsAccount.id,
    performed_by: user.id,
    details: { account_id: accountData.id, product_id: product.id, opening_deposit, target_amount, target_date, institution_id, savings_type: product.savings_type, is_locked: isLocked },
  });

  return new Response(JSON.stringify({ success: true, savings_account: savingsAccount, account: accountData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDeposit(req: Request, body: any) {
  const supabase = getUserClient(req);
  const serviceSupabase = getServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { savings_account_id, amount, source_account_id } = body;
  const { data: savingsAccount, error: accountError } = await supabase.from('savings_accounts').select('*, savings_products(*)').eq('id', savings_account_id).eq('user_id', user.id).single();
  if (accountError || !savingsAccount) throw new Error('Savings account not found');
  if (savingsAccount.status !== 'active') throw new Error('Savings account is not active');
  if (savingsAccount.is_locked) throw new Error('Cannot deposit to locked fixed deposit account');

  // ─── Atomic debit from the funding wallet ───────────────────────
  // Previously the source account balance was only *checked* and never
  // debited — deposits silently duplicated money into savings without
  // reducing the funder's wallet. Debit atomically and refund on any
  // later failure so the ledger and savings row stay in sync.
  if (source_account_id) {
    const { error: srcDebitErr } = await supabase.rpc('atomic_debit_balance', {
      _account_id: source_account_id,
      _amount: amount,
      _currency: 'XAF',
    });
    if (srcDebitErr) {
      const msg = srcDebitErr.message || '';
      if (msg.includes('Insufficient')) throw new Error('Insufficient balance in source account');
      throw new Error(`Failed to debit source account: ${msg}`);
    }
  }

  const newBalance = parseFloat(savingsAccount.current_balance) + amount;
  const { error: updateError } = await supabase.from('savings_accounts').update({ current_balance: newBalance, available_balance: newBalance }).eq('id', savings_account_id);
  if (updateError) {
    if (source_account_id) {
      await supabase.rpc('atomic_credit_balance', { _account_id: source_account_id, _amount: amount, _currency: 'XAF' });
    }
    throw new Error('Failed to update savings balance');
  }

  const txRef = `DEP-${Date.now()}`;
  await supabase.from('savings_transactions').insert({ savings_account_id, user_id: user.id, transaction_type: 'deposit', amount, balance_after: newBalance, source_account_id, description: 'Deposit to savings', reference: txRef });

  // Credit the savings-linked account balance atomically (not a raw upsert)
  await supabase.rpc('atomic_credit_balance', { _account_id: savingsAccount.account_id, _amount: amount, _currency: 'XAF' });

  // Canonical ledger rows for both sides
  const nowIso = new Date().toISOString();
  if (source_account_id) {
    await supabase.from('transactions').insert({
      account_id: source_account_id,
      amount, currency: 'XAF', credit_debit_indicator: 'Debit',
      status: 'Booked', booking_datetime: nowIso,
      transaction_information: `Transfer to savings (${savingsAccount.account_name || 'Savings'})`,
      transaction_reference: txRef,
    });
  }
  await supabase.from('transactions').insert({
    account_id: savingsAccount.account_id,
    amount, currency: 'XAF', credit_debit_indicator: 'Credit',
    status: 'Booked', booking_datetime: nowIso,
    transaction_information: `Deposit to savings (${savingsAccount.account_name || 'Savings'})`,
    transaction_reference: txRef,
  });


  // Credit event (non-blocking)
  try {
    await serviceSupabase.from('credit_events').insert({ user_id: user.id, institution_id: savingsAccount.institution_id || null, event_type: 'SAVINGS_DEPOSIT', event_time: new Date().toISOString(), value_numeric: amount, metadata: { savings_account_id, balance_after: newBalance, transaction_ref: txRef }, source: 'savings_service' });
  } catch (e) { console.error('Credit event failed:', e); }

  let goalReached = false;
  if (savingsAccount.target_amount && newBalance >= parseFloat(savingsAccount.target_amount)) goalReached = true;

  // ✉️ Email customer: savings deposit confirmed
  const customerName = await getUserName(serviceSupabase, user.id);
  sendManagedEmail(serviceSupabase, {
    email_key: 'savings_deposit_confirmed',
    recipient_user_id: user.id,
    institution_id: savingsAccount.institution_id || undefined,
    variables: { customer_name: customerName, currency: 'XAF', amount: new Intl.NumberFormat('fr-CM').format(amount), account_name: savingsAccount.account_name || 'Savings', new_balance: new Intl.NumberFormat('fr-CM').format(newBalance), reference: txRef },
  });

  // ✉️ If savings goal reached, send congratulatory email
  if (goalReached) {
    sendManagedEmail(serviceSupabase, {
      email_key: 'savings_goal_reached',
      recipient_user_id: user.id,
      institution_id: savingsAccount.institution_id || undefined,
      variables: { customer_name: customerName, currency: 'XAF', target_amount: new Intl.NumberFormat('fr-CM').format(savingsAccount.target_amount), account_name: savingsAccount.account_name || 'Savings', current_balance: new Intl.NumberFormat('fr-CM').format(newBalance) },
    });
  }

  return new Response(JSON.stringify({ success: true, new_balance: newBalance, goal_reached: goalReached, transaction_ref: txRef }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleWithdraw(req: Request, body: any) {
  const supabase = getUserClient(req);
  const serviceSupabase = getServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { savings_account_id, amount, destination_account_id } = body;
  const { data: savingsAccount, error: accountError } = await supabase.from('savings_accounts').select('*, savings_products(*)').eq('id', savings_account_id).eq('user_id', user.id).single();
  if (accountError || !savingsAccount) throw new Error('Savings account not found');
  if (savingsAccount.status !== 'active') throw new Error('Savings account is not active');

  if (savingsAccount.is_locked) {
    const today = new Date(), maturityDate = new Date(savingsAccount.maturity_date);
    if (today < maturityDate) {
      const product = savingsAccount.savings_products;
      const penalty = (amount * (product.early_closure_penalty || 0)) / 100;
      return new Response(JSON.stringify({ error: 'Account is locked until maturity', maturity_date: savingsAccount.maturity_date, early_closure_penalty: penalty, requires_confirmation: true }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const product = savingsAccount.savings_products;
  const currentMonth = new Date().getMonth();
  const lastWithdrawal = savingsAccount.last_withdrawal_date ? new Date(savingsAccount.last_withdrawal_date) : null;
  let withdrawalsThisMonth = savingsAccount.withdrawals_this_month || 0;
  if (lastWithdrawal && lastWithdrawal.getMonth() !== currentMonth) withdrawalsThisMonth = 0;
  if (product.max_withdrawals_per_month && withdrawalsThisMonth >= product.max_withdrawals_per_month) throw new Error(`Maximum ${product.max_withdrawals_per_month} withdrawals per month exceeded`);
  if (parseFloat(savingsAccount.available_balance) < amount) throw new Error('Insufficient available balance');

  const remainingBalance = parseFloat(savingsAccount.current_balance) - amount;
  if (product.min_balance && remainingBalance < product.min_balance && remainingBalance > 0) throw new Error(`Minimum balance of ${product.min_balance} XAF must be maintained`);

  await supabase.from('savings_accounts').update({ current_balance: remainingBalance, available_balance: remainingBalance, withdrawals_this_month: withdrawalsThisMonth + 1, last_withdrawal_date: new Date().toISOString().split('T')[0] }).eq('id', savings_account_id);

  const txRef = `WTH-${Date.now()}`;
  await supabase.from('savings_transactions').insert({ savings_account_id, user_id: user.id, transaction_type: 'withdrawal', amount, balance_after: remainingBalance, destination_account_id, description: 'Withdrawal from savings', reference: txRef });

  // Atomically debit the savings-linked account and credit destination
  await supabase.rpc('atomic_debit_balance', { _account_id: savingsAccount.account_id, _amount: amount, _currency: 'XAF' });
  if (destination_account_id) {
    await supabase.rpc('atomic_credit_balance', { _account_id: destination_account_id, _amount: amount, _currency: 'XAF' });
  }

  // Canonical ledger rows for both sides
  const wdIso = new Date().toISOString();
  await supabase.from('transactions').insert({
    account_id: savingsAccount.account_id,
    amount, currency: 'XAF', credit_debit_indicator: 'Debit',
    status: 'Booked', booking_datetime: wdIso,
    transaction_information: `Withdrawal from savings (${savingsAccount.account_name || 'Savings'})`,
    transaction_reference: txRef,
  });
  if (destination_account_id) {
    await supabase.from('transactions').insert({
      account_id: destination_account_id,
      amount, currency: 'XAF', credit_debit_indicator: 'Credit',
      status: 'Booked', booking_datetime: wdIso,
      transaction_information: `Withdrawal from savings (${savingsAccount.account_name || 'Savings'})`,
      transaction_reference: txRef,
    });
  }

  try { await serviceSupabase.from('credit_events').insert({ user_id: user.id, institution_id: savingsAccount.institution_id || null, event_type: 'SAVINGS_WITHDRAWAL', event_time: new Date().toISOString(), value_numeric: amount, metadata: { savings_account_id, balance_after: remainingBalance, transaction_ref: txRef }, source: 'savings_service' }); } catch (e) { console.error('Credit event failed:', e); }

  // ✉️ Email customer: savings withdrawal confirmed
  const wdCustomerName = await getUserName(serviceSupabase, user.id);
  sendManagedEmail(serviceSupabase, {
    email_key: 'savings_withdrawal_confirmed',
    recipient_user_id: user.id,
    institution_id: savingsAccount.institution_id || undefined,
    variables: { customer_name: wdCustomerName, currency: 'XAF', amount: new Intl.NumberFormat('fr-CM').format(amount), account_name: savingsAccount.account_name || 'Savings', remaining_balance: new Intl.NumberFormat('fr-CM').format(remainingBalance), reference: txRef },
  });

  await recordAuditEvent({
    action_type: 'savings_withdrawal',
    entity_type: 'savings_account',
    entity_id: savings_account_id,
    performed_by: user.id,
    details: { amount, remaining_balance: remainingBalance, transaction_ref: txRef, destination_account_id, was_locked: savingsAccount.is_locked, withdrawals_this_month: withdrawalsThisMonth + 1 },
  });

  if (amount >= SAVINGS_ANOMALY_THRESHOLD_XAF || savingsAccount.is_locked) {
    notifyAdmins(serviceSupabase, {
      event_type: 'savings_anomaly_withdrawal',
      entity_type: 'savings_account',
      entity_id: savings_account_id,
      title: savingsAccount.is_locked ? 'Locked savings withdrawal' : 'Large savings withdrawal',
      message: `${new Intl.NumberFormat('fr-CM').format(amount)} XAF withdrawn from savings account ${savingsAccount.account_name || savings_account_id.slice(0, 8)}.`,
      institution_id: savingsAccount.institution_id || undefined,
      metadata: { amount, remaining_balance: remainingBalance, transaction_ref: txRef, was_locked: savingsAccount.is_locked },
    });
  }

  return new Response(JSON.stringify({ success: true, new_balance: remainingBalance, withdrawals_remaining: (product.max_withdrawals_per_month || 999) - (withdrawalsThisMonth + 1), transaction_ref: txRef }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleAccrueInterest(req: Request, body: any) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = getServiceClient();
  const accrualDate = body.accrual_date || new Date().toISOString().split('T')[0];

  const { data: accounts, error: accErr } = await supabase.from('savings_accounts').select('id, current_balance, current_interest_rate, interest_accrued, total_interest_earned, last_interest_date, product_id, user_id, savings_products(base_interest_rate, interest_payment_frequency)').eq('status', 'active').gt('current_balance', 0);
  if (accErr) throw accErr;
  if (!accounts || accounts.length === 0) return new Response(JSON.stringify({ processed: 0, total_interest: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let processedCount = 0, totalInterest = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const { data: existingAccrual } = await supabase.from('interest_accruals').select('id').eq('savings_account_id', account.id).eq('accrual_date', accrualDate).maybeSingle();
      if (existingAccrual) continue;

      const annualRate = account.current_interest_rate || (account.savings_products as any)?.base_interest_rate || 0;
      if (annualRate <= 0) continue;
      const dailyRate = annualRate / 100 / 365;
      const balance = Number(account.current_balance);
      const accruedAmount = Math.round(balance * dailyRate);
      if (accruedAmount <= 0) continue;

      await supabase.from('interest_accruals').insert({ savings_account_id: account.id, accrual_date: accrualDate, interest_rate: annualRate, accrued_amount: accruedAmount, balance_before: balance, balance_after: balance + accruedAmount });
      await supabase.from('savings_accounts').update({ interest_accrued: (Number(account.interest_accrued) || 0) + accruedAmount, total_interest_earned: (Number(account.total_interest_earned) || 0) + accruedAmount, last_interest_date: accrualDate }).eq('id', account.id);
      processedCount++;
      totalInterest += accruedAmount;
    } catch (err) {
      errors.push(`${account.id}: ${(err as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ processed: processedCount, total_interest: totalInterest, accrual_date: accrualDate, errors: errors.length > 0 ? errors : undefined }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}