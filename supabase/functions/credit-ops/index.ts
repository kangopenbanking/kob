import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    switch (action) {
      case 'profile-get': return await handleProfileGet(req);
      case 'events-list': return await handleEventsList(req);
      case 'explain': return await handleExplain(req);
      case 'recompute': return await handleRecompute(req);
      case 'preapproved-offers': return await handlePreapprovedOffers(req, body);
      case 'apply-preapproved': return await handleApplyPreapproved(req, body);
      case 'review-application': return await handleReviewApplication(req, body);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    console.error('credit-ops error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function getAuthClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error('Unauthorized');
  
  const user = { id: data.claims.sub, email: data.claims.email };
  return { user, supabase };
}

async function handleProfileGet(req: Request) {
  const { user, supabase } = await getUser(req);
  const { data: profile } = await supabase.from('credit_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const { data: latestSnapshot } = await supabase.from('credit_score_snapshots').select('*').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(1).maybeSingle();
  return new Response(JSON.stringify({ profile: profile || { current_score: 500, score_band: 'C', last_computed_at: null }, latest_snapshot: latestSnapshot }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleEventsList(req: Request) {
  const { user, supabase } = await getUser(req);
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const type = url.searchParams.get('type');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase.from('credit_events').select('*', { count: 'exact' }).eq('user_id', user.id).order('event_time', { ascending: false }).range(offset, offset + limit - 1);
  if (from) query = query.gte('event_time', from);
  if (to) query = query.lte('event_time', to);
  if (type) query = query.eq('event_type', type);

  const { data: events, count, error } = await query;
  if (error) throw error;
  return new Response(JSON.stringify({ events: events || [], total: count || 0, limit, offset }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleExplain(req: Request) {
  const { user, supabase } = await getUser(req);
  const { data: snapshot } = await supabase.from('credit_score_snapshots').select('*').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(1).maybeSingle();
  if (!snapshot) {
    return new Response(JSON.stringify({ score: 500, band: 'C', factors: [], summary: 'No credit history yet. Your score starts at the baseline of 500.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const factors = snapshot.factors_json || [];
  const positive = factors.filter((f: any) => f.total_impact > 0);
  const negative = factors.filter((f: any) => f.total_impact < 0);
  let summary = `Your credit score is ${snapshot.score} (${snapshot.score_band} band). `;
  if (positive.length > 0) summary += `Positive: ${positive.map((f: any) => f.description).join('; ')}. `;
  if (negative.length > 0) summary += `Areas to improve: ${negative.map((f: any) => f.description).join('; ')}.`;
  if (!positive.length && !negative.length) summary += 'Limited credit activity detected.';
  return new Response(JSON.stringify({ score: snapshot.score, band: snapshot.score_band, factors, summary, computed_at: snapshot.computed_at }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRecompute(req: Request) {
  const { user } = await getUser(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${supabaseUrl}/functions/v1/credit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` }, body: JSON.stringify({ action: 'engine', user_id: user.id }) });
  const result = await res.json();
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handlePreapprovedOffers(req: Request, body: any) {
  const { user } = await getUser(req);
  const serviceClient = getServiceClient();

  // SECURITY: resolve the score server-side from the canonical engine.
  // Never trust a client-supplied score for offer eligibility — that would let
  // anyone view (and trigger inquiries on) offers they don't qualify for.
  let creditScore = 0;
  const { data: scoreProfile } = await serviceClient
    .from('credit_profiles')
    .select('current_score')
    .eq('user_id', user.id)
    .maybeSingle();
  if (scoreProfile?.current_score) {
    creditScore = scoreProfile.current_score;
  } else {
    const { data: hist } = await serviceClient
      .from('credit_score_history')
      .select('score')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    creditScore = hist?.score || 0;
  }

  // No score yet → no offers; the UI will prompt the user to complete an assessment.
  if (creditScore <= 0) {
    return new Response(JSON.stringify({ offers: [], current_score: 0, reason: 'NO_SCORE' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Fetch active offers where user's score meets benchmark
  const { data: offers, error } = await serviceClient
    .from('preapproved_loan_offers')
    .select('*, institutions!inner(institution_name)')
    .eq('is_active', true)
    .lte('min_credit_score', creditScore)
    .gte('max_credit_score', creditScore)
    .lte('effective_from', new Date().toISOString().split('T')[0])
    .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().split('T')[0]}`);

  if (error) throw error;

  // Check which institutions user has accounts with
  const { data: userAccounts } = await serviceClient
    .from('accounts')
    .select('institution_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const userInstitutionIds = new Set((userAccounts || []).map((a: any) => a.institution_id));

  // Log soft inquiry for browsing offers
  await serviceClient.from('credit_inquiries').insert({
    user_id: user.id,
    inquiry_type: 'soft',
    inquirer_type: 'system',
    inquirer_name: 'CrediQ Pre-Approval Check',
    purpose: 'Pre-approved loan eligibility check',
    score_impact: 0,
    score_provided: creditScore,
  });

  // Resolve bank deep-link info per institution (one query for all unique institutions)
  const institutionIds = Array.from(new Set((offers || []).map((o: any) => o.institution_id)));
  const bankMap = new Map<string, any>();
  if (institutionIds.length > 0) {
    const { data: banks } = await serviceClient
      .from('banks')
      .select('id, display_name, short_code, institution_id, status')
      .in('institution_id', institutionIds)
      .eq('status', 'active');
    (banks || []).forEach((b: any) => bankMap.set(b.institution_id, b));
  }

  // Look up the user's existing applications for these offers so we can hide the
  // Apply button and show a "pending review" indicator instead. We treat any
  // non-terminal status (pending_review, approved, disbursed) as "already applied".
  const offerIds = (offers || []).map((o: any) => o.id);
  const existingAppByOffer = new Map<string, any>();
  if (offerIds.length > 0) {
    const { data: existingApps, error: existingErr } = await serviceClient
      .from('preapproved_loan_applications')
      .select('id, offer_id, status, created_at')
      .eq('user_id', user.id)
      .in('offer_id', offerIds)
      .in('status', ['pending_review', 'hard_check_initiated', 'approved', 'disbursed'])
      .order('created_at', { ascending: false });
    if (existingErr) {
      console.error('preapproved-offers: existing applications lookup failed', existingErr);
    }
    (existingApps || []).forEach((a: any) => {
      // Keep the most recent per offer (first wins because we ordered desc)
      if (!existingAppByOffer.has(a.offer_id)) existingAppByOffer.set(a.offer_id, a);
    });
  }

  const enrichedOffers = (offers || []).map((offer: any) => {
    const hasAccount = userInstitutionIds.has(offer.institution_id);
    const bank = bankMap.get(offer.institution_id);
    const existing = existingAppByOffer.get(offer.id) || null;
    return {
      id: offer.id,
      institution_id: offer.institution_id,
      product_name: offer.product_name,
      description: offer.description,
      min_credit_score: offer.min_credit_score,
      max_credit_score: offer.max_credit_score,
      min_amount: offer.min_amount,
      max_amount: offer.max_amount,
      interest_rate_annual: offer.interest_rate_annual,
      max_tenure_months: offer.max_tenure_months,
      currency: offer.currency,
      requires_existing_account: offer.requires_existing_account && !hasAccount,
      has_existing_account: hasAccount,
      institution_name: offer.institutions?.institution_name || 'Financial Institution',
      bank_id: bank?.id || null,
      bank_name: bank?.display_name || null,
      apply_path: bank?.id ? `/bank/${bank.id}/apply` : null,
      already_applied: !!existing,
      existing_application: existing
        ? {
            id: existing.id,
            status: existing.status,
            reference: existing.id.slice(0, 8).toUpperCase(),
            applied_at: existing.created_at,
          }
        : null,
    };
  });

  return new Response(JSON.stringify({ offers: enrichedOffers, current_score: creditScore }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Structured error helper. We return HTTP 200 with success:false so that
// supabase.functions.invoke surfaces the JSON body to the client (otherwise
// non-2xx responses are reduced to a generic FunctionsHttpError). The client
// inspects `success` and `code` to render an actionable message.
function appError(code: string, message: string, details?: string, extra: Record<string, any> = {}) {
  return new Response(JSON.stringify({
    success: false,
    code,
    error: code,
    message,
    details,
    ...extra,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleApplyPreapproved(req: Request, body: any) {
  let user: any;
  try {
    ({ user } = await getUser(req));
  } catch {
    return appError('UNAUTHENTICATED', 'Please sign in again to continue.', 'Your session has expired or is invalid.');
  }

  const { offer_id, requested_amount, requested_tenure_months } = body;

  if (!offer_id || !requested_amount) {
    return appError('INVALID_INPUT', 'Missing application details.', 'An offer and a requested amount are required to submit your application.');
  }

  const serviceClient = getServiceClient();

  const { data: offer, error: offerErr } = await serviceClient
    .from('preapproved_loan_offers')
    .select('*, institutions!inner(institution_name)')
    .eq('id', offer_id)
    .maybeSingle();

  if (offerErr) {
    console.error('apply-preapproved: offer lookup failed', offerErr);
    return appError('OFFER_LOOKUP_FAILED', 'We could not load this loan offer.', 'Please refresh and try again. If the issue persists, contact support.');
  }
  if (!offer) {
    return appError('OFFER_NOT_FOUND', 'This loan offer is no longer available.', 'Please refresh the offer list and pick a current offer.');
  }
  if (!offer.is_active) {
    return appError('OFFER_INACTIVE', 'This loan offer is no longer active.', 'The bank has paused this offer. Please choose another offer.');
  }
  const today = new Date().toISOString().split('T')[0];
  if (offer.effective_to && offer.effective_to < today) {
    return appError('OFFER_EXPIRED', 'This pre-approved offer has expired.', `Offer ended on ${offer.effective_to}. Please pick a current offer.`);
  }

  const institutionName = offer.institutions?.institution_name || 'the bank';

  // Canonical score from credit_profiles, fall back to history
  let currentScore = 0;
  const { data: profile } = await serviceClient
    .from('credit_profiles')
    .select('current_score')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.current_score) {
    currentScore = profile.current_score;
  } else {
    const { data: hist } = await serviceClient
      .from('credit_score_history')
      .select('score')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    currentScore = hist?.score || 0;
  }

  if (currentScore <= 0) {
    return appError(
      'NO_CREDIT_SCORE',
      'You need a CrediQ score before applying.',
      'Complete your free CrediQ assessment to unlock pre-approved offers.',
      { next_step: { action: 'complete_assessment', label: 'Start free assessment' } }
    );
  }

  if (currentScore < offer.min_credit_score) {
    return appError(
      'SCORE_TOO_LOW',
      `Your CrediQ score of ${currentScore} no longer meets the minimum (${offer.min_credit_score}) for this offer.`,
      'Your score may have changed since the offer was generated. Improve your score by paying bills on time, or browse other offers that match your current score.',
      { current_score: currentScore, required_score: offer.min_credit_score }
    );
  }

  if (requested_amount < offer.min_amount || requested_amount > offer.max_amount) {
    const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
    return appError(
      'AMOUNT_OUT_OF_RANGE',
      `Amount must be between ${fmt(offer.min_amount)} and ${fmt(offer.max_amount)} ${offer.currency}.`,
      'Adjust the loan amount within the allowed range and try again.',
      { min_amount: offer.min_amount, max_amount: offer.max_amount, currency: offer.currency }
    );
  }

  const { data: existingAccounts } = await serviceClient
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('institution_id', offer.institution_id)
    .eq('is_active', true)
    .limit(1);

  const hasExistingAccount = (existingAccounts || []).length > 0;

  if (offer.requires_existing_account && !hasExistingAccount) {
    const { data: bank } = await serviceClient
      .from('banks')
      .select('id, display_name, short_code')
      .eq('institution_id', offer.institution_id)
      .eq('status', 'active')
      .maybeSingle();

    return new Response(JSON.stringify({
      success: false,
      error: 'account_required',
      code: 'ACCOUNT_REQUIRED',
      message: `You need an account with ${institutionName} before applying for this loan.`,
      details: 'Open an account with this bank to continue. Your loan eligibility will be preserved.',
      onboarding: {
        institution_id: offer.institution_id,
        institution_name: institutionName,
        bank_id: bank?.id || null,
        bank_name: bank?.display_name || null,
        bank_short_code: bank?.short_code || null,
        apply_path: bank?.id ? `/bank/${bank.id}/apply` : null,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Idempotency: prevent duplicate active applications for the same offer
  const { data: existingApp } = await serviceClient
    .from('preapproved_loan_applications')
    .select('id, status, created_at')
    .eq('user_id', user.id)
    .eq('offer_id', offer_id)
    .in('status', ['pending_review', 'hard_check_initiated', 'approved', 'disbursed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingApp) {
    return appError(
      'DUPLICATE_APPLICATION',
      'You already have an active application for this offer.',
      `Application reference ${existingApp.id.slice(0, 8).toUpperCase()} is currently ${String(existingApp.status).replace(/_/g, ' ')}. The bank will contact you with next steps.`,
      { application_id: existingApp.id, status: existingApp.status }
    );
  }

  // Create the application FIRST so a failed inquiry insert doesn't leave an
  // orphaned -5 score impact with no corresponding loan application.
  const { data: application, error: appErr } = await serviceClient
    .from('preapproved_loan_applications')
    .insert({
      offer_id,
      user_id: user.id,
      institution_id: offer.institution_id,
      requested_amount,
      requested_tenure_months: requested_tenure_months || offer.max_tenure_months,
      status: 'pending_review',
      credit_score_at_application: currentScore,
      has_existing_account: hasExistingAccount,
      score_impact: -5,
    })
    .select('id')
    .single();

  if (appErr) {
    console.error('apply-preapproved: application insert failed', appErr);
    return appError('APPLICATION_FAILED', 'We could not submit your application.', 'A temporary issue prevented submission. Please try again. No credit inquiry was recorded.');
  }

  // Now log the hard inquiry tied to this application.
  const { data: inquiry, error: inqErr } = await serviceClient
    .from('credit_inquiries')
    .insert({
      user_id: user.id,
      inquiry_type: 'hard',
      inquirer_type: 'institution',
      inquirer_name: `${institutionName} - ${offer.product_name}`,
      inquirer_id: offer.institution_id,
      purpose: `Pre-approved loan application: ${offer.product_name}`,
      score_impact: -5,
      score_provided: currentScore,
      status: 'completed',
    })
    .select('id')
    .single();

  if (inqErr) {
    // Roll back the application so the user can retry cleanly.
    console.error('apply-preapproved: hard inquiry insert failed, rolling back application', inqErr);
    await serviceClient.from('preapproved_loan_applications').delete().eq('id', application.id);
    return appError('INQUIRY_FAILED', 'We could not record your credit inquiry.', 'Please try again in a moment. No application has been created.');
  }

  // Link inquiry back to the application.
  await serviceClient
    .from('preapproved_loan_applications')
    .update({ hard_inquiry_id: inquiry.id })
    .eq('id', application.id);

  // Emit credit event for the engine and trigger an async recompute so the
  // user's displayed score reflects the -5 hard-inquiry impact immediately.
  try {
    await serviceClient.from('credit_events').insert({
      user_id: user.id,
      event_type: 'HARD_INQUIRY',
      event_time: new Date().toISOString(),
      source: 'preapproved_loan',
      description: `Hard credit check for ${offer.product_name} loan application`,
      value_numeric: -5,
      institution_id: offer.institution_id,
      metadata: { offer_id, application_id: application.id, inquiry_id: inquiry.id, institution_id: offer.institution_id },
    });
  } catch (e) { console.warn('credit_events insert (non-critical) failed', e); }

  // Fire-and-forget recompute via the engine so the next score read is fresh.
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/credit-score-engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id: user.id }),
    }).catch((e) => console.warn('async recompute trigger failed', e));
  } catch (e) { console.warn('recompute fire-and-forget failed', e); }

  return new Response(JSON.stringify({
    success: true,
    application_id: application.id,
    status: 'pending_review',
    hard_inquiry_logged: true,
    score_impact: -5,
    institution_name: institutionName,
    product_name: offer.product_name,
    message: `Your ${offer.product_name} application has been submitted to ${institutionName}.`,
    details: 'The bank will perform additional checks and contact you with a decision. A small temporary score impact (~5 points) has been recorded for the hard inquiry.',
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleReviewApplication(req: Request, body: any) {
  const { user } = await getUser(req);
  const { application_id, decision, decline_reason, review_notes } = body;

  if (!application_id || !decision || !['approved', 'declined'].includes(decision)) {
    return new Response(JSON.stringify({ error: 'application_id and decision (approved/declined) are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const serviceClient = getServiceClient();

  // Verify the reviewer is staff/owner of the institution
  const { data: app, error: appErr } = await serviceClient
    .from('preapproved_loan_applications')
    .select('*, preapproved_loan_offers!inner(product_name, institution_id, interest_rate_annual)')
    .eq('id', application_id)
    .maybeSingle();

  if (appErr || !app) {
    return new Response(JSON.stringify({ error: 'Application not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Verify reviewer belongs to the institution
  const { data: inst } = await serviceClient.from('institutions').select('id, institution_name').eq('id', app.institution_id).eq('user_id', user.id).maybeSingle();
  let reviewerInstitution = inst;
  if (!reviewerInstitution) {
    const { data: staffInst } = await serviceClient.from('staff_assignments').select('institution_id, institutions!inner(id, institution_name)').eq('user_id', user.id).eq('institution_id', app.institution_id).eq('is_active', true).maybeSingle();
    if (staffInst) reviewerInstitution = staffInst.institutions as any;
  }
  if (!reviewerInstitution) {
    return new Response(JSON.stringify({ error: 'Unauthorized: you are not authorized to review this application' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Update application status
  const updateData: any = {
    status: decision,
    updated_at: new Date().toISOString(),
  };
  if (decision === 'declined' && decline_reason) {
    updateData.decline_reason = decline_reason;
  }

  const { error: updateErr } = await serviceClient
    .from('preapproved_loan_applications')
    .update(updateData)
    .eq('id', application_id);

  if (updateErr) throw updateErr;

  // Get customer profile for notification
  const { data: customerProfile } = await serviceClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', app.user_id)
    .maybeSingle();

  const productName = app.preapproved_loan_offers?.product_name || 'Loan';
  const institutionName = reviewerInstitution.institution_name || 'Your Bank';
  const customerName = customerProfile?.full_name || 'Customer';
  const amountFormatted = new Intl.NumberFormat('fr-CM', { style: 'decimal' }).format(app.requested_amount) + ' XAF';

  // Build notification content
  const isApproved = decision === 'approved';
  const notifTitle = isApproved
    ? `Loan Application Approved 🎉`
    : `Loan Application Update`;
  const notifMessage = isApproved
    ? `Great news! Your ${productName} application for ${amountFormatted} with ${institutionName} has been approved. Please contact the bank for next steps.`
    : `Your ${productName} application for ${amountFormatted} with ${institutionName} was not approved. ${decline_reason || 'Please contact the bank for more information.'}`;

  // Send in-app push notification
  try {
    await serviceClient.from('app_notifications').insert({
      user_id: app.user_id,
      institution_id: app.institution_id,
      type: isApproved ? 'success' : 'warning',
      title: notifTitle,
      message: notifMessage,
      icon: isApproved ? 'check-circle' : 'x-circle',
      metadata: { application_id, decision, product_name: productName },
    });
  } catch (_) { /* non-critical */ }

  // Send push notification via push-notification function
  try {
    const pushUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notification`;
    await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: app.user_id,
        institution_id: app.institution_id,
        type: isApproved ? 'success' : 'warning',
        title: notifTitle,
        message: notifMessage,
        icon: isApproved ? 'check-circle' : 'x-circle',
        metadata: { application_id, decision },
      }),
    });
  } catch (_) { /* non-critical */ }

  // Send email notification via managed-send-email
  try {
    const emailKey = isApproved ? 'loan_approved_email' : 'loan_overdue_notice';
    await serviceClient.functions.invoke('managed-send-email', {
      body: {
        email_key: emailKey,
        recipient_email: customerProfile?.email || '',
        institution_id: app.institution_id,
        variables: {
          customer_name: customerName,
          product_name: productName,
          amount: amountFormatted,
          institution_name: institutionName,
          decision: isApproved ? 'Approved' : 'Declined',
          decline_reason: decline_reason || '',
          application_number: application_id,
        },
      },
    });
  } catch (_) { /* non-critical */ }

  // Log credit event for the decision
  try {
    await serviceClient.from('credit_events').insert({
      user_id: app.user_id,
      event_type: isApproved ? 'LOAN_CLOSED' : 'HARD_INQUIRY',
      event_time: new Date().toISOString(),
      source: 'preapproved_loan',
      description: `${productName} application ${decision} by ${institutionName}`,
      value_numeric: 0,
      metadata: { application_id, decision, reviewer_id: user.id, institution_id: app.institution_id },
    });
  } catch (_) { /* non-critical */ }

  return new Response(JSON.stringify({
    success: true,
    application_id,
    decision,
    notifications_sent: true,
    message: `Application ${decision} successfully. Customer has been notified via push notification and email.`,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
