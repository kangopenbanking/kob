// Overdraft eligibility engine and management operations
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { sendManagedEmail, getAccountRef, getUserName, emailManagers } from '../_shared/send-managed-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    if (!action) return error(400, 'action parameter required');

    switch (action) {
      case 'get-profile': return handleGetProfile(req, body);
      case 'recalculate': return handleRecalculate(req, body);
      case 'request': return handleRequest(req, body);
      case 'approve': return handleApprove(req, body);
      case 'suspend': return handleSuspend(req, body);
      case 'revoke': return handleRevoke(req, body);
      case 'reinstate': return handleReinstate(req, body);
      default: return error(400, `Unknown action: ${action}`);
    }
  } catch (err: any) {
    const msg = err.message || 'internal_error';
    if (msg.includes('authorization') || msg.includes('Unauthorized')) return error(401, msg);
    if (msg.includes('Access denied')) return error(403, msg);
    console.error('overdraft-ops error:', err);
    return error(500, 'internal_error');
  }
});

function error(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function ok(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getAuthUser(req: Request) {
  const supabase = getServiceClient();
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Missing authorization');
  const { data: { user }, error: e } = await supabase.auth.getUser(token);
  if (e || !user) throw new Error('Unauthorized');
  return user;
}

// ═══════════════════════════════════════════════════════════════════
// OVERDRAFT SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════

interface ScoreFactors {
  salary_score: number;
  savings_score: number;
  balance_score: number;
  tenure_score: number;
  activity_score: number;
  repayment_score: number;
  credit_score_input: number;
  final_score: number;
  recommendation: string;
  factor_summary: Record<string, any>;
}

async function calculateOverdraftScore(supabase: any, accountId: string, userId: string): Promise<ScoreFactors> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Salary score
  let salaryScore = 0;
  const { data: credits } = await supabase.from('transactions').select('amount, booking_datetime')
    .eq('account_id', accountId).eq('credit_debit_indicator', 'Credit')
    .gte('booking_datetime', sixMonthsAgo).order('booking_datetime', { ascending: false }).limit(100);

  if (credits && credits.length > 0) {
    const monthlyCredits: Record<string, number[]> = {};
    credits.forEach((tx: any) => {
      const month = tx.booking_datetime.substring(0, 7);
      if (!monthlyCredits[month]) monthlyCredits[month] = [];
      monthlyCredits[month].push(Number(tx.amount));
    });
    const months = Object.keys(monthlyCredits).length;
    if (months >= 3) salaryScore += 5;
    if (months >= 6) salaryScore += 5;
    const allAmounts = credits.map((c: any) => Number(c.amount));
    const avgCredit = allAmounts.reduce((a: number, b: number) => a + b, 0) / allAmounts.length;
    const recurringCredits = allAmounts.filter((a: number) => Math.abs(a - avgCredit) / avgCredit < 0.15);
    if (recurringCredits.length >= 3) salaryScore += 10;
  }

  // 2. Savings score
  let savingsScore = 0;
  const { data: savingsAccounts } = await supabase.from('savings_accounts').select('current_balance, status')
    .eq('user_id', userId).eq('status', 'active');
  if (savingsAccounts && savingsAccounts.length > 0) {
    const totalSavings = savingsAccounts.reduce((sum: number, sa: any) => sum + Number(sa.current_balance), 0);
    if (totalSavings > 0) savingsScore += 5;
    if (totalSavings > 50000) savingsScore += 5;
    if (totalSavings > 200000) savingsScore += 5;
    if (totalSavings > 500000) savingsScore += 5;
  }

  // 3. Balance score
  let balanceScore = 0;
  const { data: balances } = await supabase.from('account_balances').select('amount, balance_datetime')
    .eq('account_id', accountId).in('balance_type', ['InterimAvailable', 'ClosingAvailable'])
    .gte('balance_datetime', threeMonthsAgo).order('balance_datetime', { ascending: false }).limit(90);
  if (balances && balances.length > 0) {
    const avgBalance = balances.reduce((sum: number, b: any) => sum + Number(b.amount), 0) / balances.length;
    if (avgBalance > 0) balanceScore += 5;
    if (avgBalance > 100000) balanceScore += 5;
    if (avgBalance > 500000) balanceScore += 5;
    if (avgBalance > 1000000) balanceScore += 5;
  }

  // 4. Tenure score
  let tenureScore = 0;
  const { data: account } = await supabase.from('accounts').select('opened_date, created_at').eq('id', accountId).single();
  if (account) {
    const openedDate = new Date(account.opened_date || account.created_at);
    const tenureMonths = (now.getTime() - openedDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (tenureMonths >= 3) tenureScore += 5;
    if (tenureMonths >= 6) tenureScore += 5;
    if (tenureMonths >= 12) tenureScore += 5;
    if (tenureMonths >= 24) tenureScore += 5;
  }

  // 5. Activity score
  let activityScore = 0;
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true })
    .eq('account_id', accountId).gte('booking_datetime', threeMonthsAgo);
  if (txCount && txCount > 10) activityScore += 5;
  if (txCount && txCount > 30) activityScore += 5;
  if (txCount && txCount > 60) activityScore += 5;
  if (txCount && txCount > 100) activityScore += 5;

  // 6. Repayment score
  let repaymentScore = 0;
  const { data: loanAccounts } = await supabase.from('loan_accounts').select('id, status').eq('user_id', userId);
  if (loanAccounts && loanAccounts.length > 0) {
    const closedLoans = loanAccounts.filter((la: any) => la.status === 'closed' || la.status === 'completed');
    if (closedLoans.length > 0) repaymentScore += 10;
    const { data: onTimePayments } = await supabase.from('loan_repayment_schedule').select('id')
      .in('loan_account_id', loanAccounts.map((l: any) => l.id))
      .eq('status', 'paid').limit(50);
    if (onTimePayments && onTimePayments.length > 5) repaymentScore += 5;
    if (onTimePayments && onTimePayments.length > 10) repaymentScore += 5;
  }

  // 7. Credit score input
  let creditScoreInput = 0;
  const { data: creditScore } = await supabase.from('credit_scores').select('score').eq('user_id', userId).order('calculated_at', { ascending: false }).limit(1).maybeSingle();
  if (creditScore) {
    const score = creditScore.score;
    if (score >= 750) creditScoreInput = 20;
    else if (score >= 650) creditScoreInput = 15;
    else if (score >= 550) creditScoreInput = 10;
    else if (score >= 400) creditScoreInput = 5;
    else creditScoreInput = 0;
  }

  const finalScore = Math.min(100, salaryScore + savingsScore + balanceScore + tenureScore + activityScore + repaymentScore + creditScoreInput);

  let recommendation: string;
  let riskBand: string;
  if (finalScore >= 75) { recommendation = 'Highly eligible — auto-approve recommended'; riskBand = 'A'; }
  else if (finalScore >= 55) { recommendation = 'Eligible — manual approval recommended'; riskBand = 'B'; }
  else if (finalScore >= 40) { recommendation = 'Marginally eligible — enhanced review required'; riskBand = 'C'; }
  else if (finalScore >= 25) { recommendation = 'Low eligibility — high risk'; riskBand = 'D'; }
  else { recommendation = 'Not eligible — insufficient account activity'; riskBand = 'F'; }

  return {
    salary_score: salaryScore, savings_score: savingsScore, balance_score: balanceScore,
    tenure_score: tenureScore, activity_score: activityScore, repayment_score: repaymentScore,
    credit_score_input: creditScoreInput, final_score: finalScore, recommendation,
    factor_summary: {
      salary_pattern: salaryScore > 10 ? 'strong' : salaryScore > 5 ? 'moderate' : 'weak',
      savings_health: savingsScore > 10 ? 'strong' : savingsScore > 5 ? 'moderate' : 'weak',
      balance_stability: balanceScore > 10 ? 'strong' : balanceScore > 5 ? 'moderate' : 'weak',
      account_tenure: tenureScore > 10 ? 'established' : tenureScore > 5 ? 'moderate' : 'new',
      transaction_activity: activityScore > 10 ? 'high' : activityScore > 5 ? 'moderate' : 'low',
      repayment_history: repaymentScore > 10 ? 'excellent' : repaymentScore > 5 ? 'good' : 'limited',
      credit_profile: creditScoreInput > 15 ? 'strong' : creditScoreInput > 10 ? 'fair' : 'weak',
      risk_band: riskBand,
    },
  };
}

function calculateRecommendedLimit(factors: ScoreFactors, avgMonthlyInflow: number): number {
  let percentage = 0;
  if (factors.final_score >= 75) percentage = 0.5;
  else if (factors.final_score >= 55) percentage = 0.3;
  else if (factors.final_score >= 40) percentage = 0.15;
  else percentage = 0;

  const limit = Math.round(avgMonthlyInflow * percentage / 1000) * 1000;
  return Math.max(0, Math.min(limit, 5000000));
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════

async function handleGetProfile(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id } = body;
  if (!account_id) return error(400, 'account_id required');

  const { data: account } = await supabase.from('accounts').select('user_id, institution_id').eq('id', account_id).single();
  if (!account) return error(404, 'Account not found');
  if (account.user_id !== user.id) {
    const { data: staff } = await supabase.from('staff_assignments').select('id').eq('user_id', user.id).eq('institution_id', account.institution_id).eq('is_active', true).maybeSingle();
    if (!staff) return error(403, 'Access denied');
  }

  const { data: profile } = await supabase.from('account_overdraft_profiles').select('*, overdraft_score_factors(*)').eq('account_id', account_id).maybeSingle();
  return ok({ overdraft_profile: profile || null });
}

async function handleRecalculate(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id } = body;
  if (!account_id) return error(400, 'account_id required');

  const { data: account } = await supabase.from('accounts').select('id, user_id, institution_id').eq('id', account_id).single();
  if (!account) return error(404, 'Account not found');

  const factors = await calculateOverdraftScore(supabase, account_id, account.user_id);

  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentCredits } = await supabase.from('transactions').select('amount')
    .eq('account_id', account_id).eq('credit_debit_indicator', 'Credit')
    .gte('booking_datetime', threeMonthsAgo);
  const totalCredits = recentCredits?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
  const avgMonthlyInflow = totalCredits / 3;

  const recommendedLimit = calculateRecommendedLimit(factors, avgMonthlyInflow);
  const eligible = factors.final_score >= 25;
  const manualApprovalRequired = factors.final_score < 75;

  const { data: profile, error: upsertErr } = await supabase.from('account_overdraft_profiles').upsert({
    account_id,
    institution_id: account.institution_id || '00000000-0000-0000-0000-000000000000',
    eligible,
    recommended_limit: recommendedLimit,
    risk_band: factors.factor_summary.risk_band,
    manual_approval_required: manualApprovalRequired,
    status: eligible ? (manualApprovalRequired ? 'pending_approval' : 'active') : 'inactive',
    last_scored_at: new Date().toISOString(),
    review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id' }).select().single();

  if (upsertErr) throw upsertErr;

  // If auto-approve eligible (score >= 75), set approved limit
  if (!manualApprovalRequired && eligible) {
    await supabase.from('account_overdraft_profiles').update({
      approved_limit: recommendedLimit,
      available_amount: recommendedLimit,
      status: 'active',
    }).eq('id', profile.id);

    // ✉️ Email customer: overdraft auto-approved
    const accountRef = await getAccountRef(supabase, account_id);
    const customerName = await getUserName(supabase, account.user_id);
    sendManagedEmail(supabase, {
      email_key: 'overdraft_approved',
      recipient_user_id: account.user_id,
      institution_id: account.institution_id,
      variables: { customer_name: customerName, account_ref: accountRef, approved_limit: new Intl.NumberFormat('fr-CM').format(recommendedLimit), available_amount: new Intl.NumberFormat('fr-CM').format(recommendedLimit), currency: 'XAF' },
    });
  } else if (eligible) {
    // ✉️ Email customer: eligible notification
    const accountRef = await getAccountRef(supabase, account_id);
    const customerName = await getUserName(supabase, account.user_id);
    sendManagedEmail(supabase, {
      email_key: 'overdraft_eligible',
      recipient_user_id: account.user_id,
      institution_id: account.institution_id,
      variables: { customer_name: customerName, account_ref: accountRef, recommended_limit: new Intl.NumberFormat('fr-CM').format(recommendedLimit), currency: 'XAF', risk_band: factors.factor_summary.risk_band },
    });
  }

  await supabase.from('overdraft_score_factors').insert({
    account_overdraft_profile_id: profile.id,
    ...factors,
    factor_summary: factors.factor_summary,
  });

  await supabase.rpc('log_audit_event', { _action_type: 'overdraft_recalculated', _entity_type: 'account', _entity_id: account_id, _details: { final_score: factors.final_score, recommended_limit: recommendedLimit, eligible, risk_band: factors.factor_summary.risk_band } });

  return ok({
    success: true,
    overdraft_profile: { ...profile, recommended_limit: recommendedLimit, eligible, risk_band: factors.factor_summary.risk_band },
    score_factors: factors,
    auto_approved: !manualApprovalRequired && eligible,
  });
}

async function handleRequest(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id, requested_limit } = body;
  if (!account_id) return error(400, 'account_id required');

  const recalcResp = await handleRecalculate(req, body);
  const recalcResult = await recalcResp.clone().json();
  if (!recalcResult.success) return recalcResp;

  if (!recalcResult.overdraft_profile.eligible) {
    return ok({ success: false, eligible: false, message: 'Account does not meet overdraft eligibility criteria', score_factors: recalcResult.score_factors });
  }

  if (recalcResult.auto_approved) {
    return ok({ success: true, status: 'auto_approved', overdraft_profile: recalcResult.overdraft_profile, message: 'Overdraft automatically approved based on account profile' });
  }

  // Create approval request for manual review
  const { data: account } = await supabase.from('accounts').select('institution_id, user_id').eq('id', account_id).single();
  const institutionId = account?.institution_id || '00000000-0000-0000-0000-000000000000';

  const { data: ar } = await supabase.from('approval_requests').insert({
    institution_id: institutionId,
    entity_type: 'overdraft_profile', entity_id: recalcResult.overdraft_profile.id,
    request_type: 'overdraft_approval', current_stage: 'pending_branch_manager',
    required_role: 'branch_manager', submitted_by: user.id, status: 'pending_branch_manager',
    reason: `Overdraft request for account. Recommended limit: ${recalcResult.overdraft_profile.recommended_limit} XAF. Risk band: ${recalcResult.overdraft_profile.risk_band}`,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();

  await supabase.from('approval_actions').insert({
    approval_request_id: ar!.id, action: 'submit', acted_by: user.id,
    comments: `Overdraft request submitted. Score: ${recalcResult.score_factors.final_score}/100`,
    metadata: { score_factors: recalcResult.score_factors, requested_limit },
  });

  // ✉️ Email managers: overdraft review required
  const accountRef = await getAccountRef(supabase, account_id);
  const customerName = account?.user_id ? await getUserName(supabase, account.user_id) : 'Customer';
  emailManagers(supabase, {
    institution_id: institutionId, role_type: 'branch_manager',
    email_key: 'overdraft_review_required',
    variables: { account_ref: accountRef, customer_name: customerName, recommended_limit: new Intl.NumberFormat('fr-CM').format(recalcResult.overdraft_profile.recommended_limit), currency: 'XAF', risk_band: recalcResult.overdraft_profile.risk_band, score: recalcResult.score_factors.final_score },
  });

  return ok({ success: true, status: 'pending_approval', approval_request: ar, overdraft_profile: recalcResult.overdraft_profile, score_factors: recalcResult.score_factors }, 202);
}

async function handleApprove(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id, approved_limit, comments } = body;
  if (!account_id || approved_limit === undefined) return error(400, 'account_id, approved_limit required');

  const { data: profile } = await supabase.from('account_overdraft_profiles').select('*').eq('account_id', account_id).single();
  if (!profile) return error(404, 'Overdraft profile not found');

  const { data: auth } = await supabase.from('staff_authorizations').select('*').eq('user_id', user.id).eq('institution_id', profile.institution_id).eq('status', 'active').maybeSingle();
  if (!auth?.can_approve_overdraft) {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    const { data: inst } = await supabase.from('institutions').select('user_id').eq('id', profile.institution_id).single();
    if (!isAdmin && inst?.user_id !== user.id) return error(403, 'Not authorized to approve overdrafts');
  }

  const availableAmount = approved_limit - profile.utilised_amount;
  await supabase.from('account_overdraft_profiles').update({
    approved_limit, available_amount: availableAmount,
    status: 'active', manual_approval_required: false, updated_at: new Date().toISOString(),
  }).eq('id', profile.id);

  // ✉️ Email customer: overdraft approved
  const { data: account } = await supabase.from('accounts').select('user_id').eq('id', account_id).single();
  if (account?.user_id) {
    const accountRef = await getAccountRef(supabase, account_id);
    const customerName = await getUserName(supabase, account.user_id);
    sendManagedEmail(supabase, {
      email_key: 'overdraft_approved',
      recipient_user_id: account.user_id,
      institution_id: profile.institution_id,
      variables: { customer_name: customerName, account_ref: accountRef, approved_limit: new Intl.NumberFormat('fr-CM').format(approved_limit), available_amount: new Intl.NumberFormat('fr-CM').format(availableAmount), currency: 'XAF' },
    });
  }

  await supabase.rpc('log_audit_event', { _action_type: 'overdraft_approved', _entity_type: 'account', _entity_id: account_id, _details: { approved_limit, approved_by: user.id, comments } });
  return ok({ success: true, status: 'active', approved_limit, available_amount: availableAmount });
}

async function handleSuspend(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id, reason } = body;
  if (!account_id) return error(400, 'account_id required');

  const { data: profile } = await supabase.from('account_overdraft_profiles').select('*').eq('account_id', account_id).single();
  if (!profile) return error(404, 'Overdraft profile not found');

  const { data: auth } = await supabase.from('staff_authorizations').select('can_suspend_overdraft').eq('user_id', user.id).eq('institution_id', profile.institution_id).eq('status', 'active').maybeSingle();
  if (!auth?.can_suspend_overdraft) {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some((r: any) => r.role === 'admin')) return error(403, 'Not authorized to suspend overdrafts');
  }

  await supabase.from('account_overdraft_profiles').update({ status: 'suspended', available_amount: 0, updated_at: new Date().toISOString() }).eq('id', profile.id);

  // ✉️ Email customer: overdraft suspended
  const { data: account } = await supabase.from('accounts').select('user_id').eq('id', account_id).single();
  if (account?.user_id) {
    const accountRef = await getAccountRef(supabase, account_id);
    const customerName = await getUserName(supabase, account.user_id);
    sendManagedEmail(supabase, {
      email_key: 'overdraft_suspended',
      recipient_user_id: account.user_id,
      institution_id: profile.institution_id,
      variables: { customer_name: customerName, account_ref: accountRef, previous_limit: new Intl.NumberFormat('fr-CM').format(profile.approved_limit), currency: 'XAF', reason: reason || 'Account review' },
    });
  }

  await supabase.rpc('log_audit_event', { _action_type: 'overdraft_suspended', _entity_type: 'account', _entity_id: account_id, _details: { reason, suspended_by: user.id } });
  return ok({ success: true, status: 'suspended' });
}

async function handleRevoke(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id, reason } = body;
  if (!account_id) return error(400, 'account_id required');

  const { data: profile } = await supabase.from('account_overdraft_profiles').select('*').eq('account_id', account_id).single();
  if (!profile) return error(404, 'Not found');

  await supabase.from('account_overdraft_profiles').update({ status: 'revoked', available_amount: 0, approved_limit: 0, updated_at: new Date().toISOString() }).eq('id', profile.id);

  // ✉️ Email customer: overdraft revoked
  const { data: account } = await supabase.from('accounts').select('user_id').eq('id', account_id).single();
  if (account?.user_id) {
    const accountRef = await getAccountRef(supabase, account_id);
    const customerName = await getUserName(supabase, account.user_id);
    sendManagedEmail(supabase, {
      email_key: 'overdraft_revoked',
      recipient_user_id: account.user_id,
      institution_id: profile.institution_id,
      variables: { customer_name: customerName, account_ref: accountRef, previous_limit: new Intl.NumberFormat('fr-CM').format(profile.approved_limit), currency: 'XAF', reason: reason || 'Policy decision' },
    });
  }

  await supabase.rpc('log_audit_event', { _action_type: 'overdraft_revoked', _entity_type: 'account', _entity_id: account_id, _details: { reason, revoked_by: user.id, previous_limit: profile.approved_limit } });
  return ok({ success: true, status: 'revoked' });
}

async function handleReinstate(req: Request, body: any) {
  const user = await getAuthUser(req);
  const supabase = getServiceClient();
  const { account_id, new_limit, comments } = body;
  if (!account_id) return error(400, 'account_id required');

  const { data: profile } = await supabase.from('account_overdraft_profiles').select('*').eq('account_id', account_id).single();
  if (!profile) return error(404, 'Not found');
  if (!['suspended', 'revoked'].includes(profile.status)) return error(422, 'Can only reinstate suspended or revoked overdrafts');

  const limit = new_limit || profile.recommended_limit;
  const availableAmount = limit - profile.utilised_amount;
  await supabase.from('account_overdraft_profiles').update({ status: 'active', approved_limit: limit, available_amount: availableAmount, updated_at: new Date().toISOString() }).eq('id', profile.id);

  // ✉️ Email customer: overdraft reinstated
  const { data: account } = await supabase.from('accounts').select('user_id').eq('id', account_id).single();
  if (account?.user_id) {
    const accountRef = await getAccountRef(supabase, account_id);
    const customerName = await getUserName(supabase, account.user_id);
    sendManagedEmail(supabase, {
      email_key: 'overdraft_reinstated',
      recipient_user_id: account.user_id,
      institution_id: profile.institution_id,
      variables: { customer_name: customerName, account_ref: accountRef, new_limit: new Intl.NumberFormat('fr-CM').format(limit), available_amount: new Intl.NumberFormat('fr-CM').format(availableAmount), currency: 'XAF' },
    });
  }

  await supabase.rpc('log_audit_event', { _action_type: 'overdraft_reinstated', _entity_type: 'account', _entity_id: account_id, _details: { new_limit: limit, reinstated_by: user.id, comments } });
  return ok({ success: true, status: 'active', approved_limit: limit });
}
