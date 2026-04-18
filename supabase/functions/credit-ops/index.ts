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
  const creditScore = body.credit_score || 0;
  const serviceClient = getServiceClient();

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

  const enrichedOffers = (offers || []).map((offer: any) => ({
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
    requires_existing_account: offer.requires_existing_account && !userInstitutionIds.has(offer.institution_id),
    institution_name: offer.institutions?.institution_name || 'Financial Institution',
  }));

  return new Response(JSON.stringify({ offers: enrichedOffers }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleApplyPreapproved(req: Request, body: any) {
  const { user } = await getUser(req);
  const { offer_id, requested_amount, requested_tenure_months } = body;

  if (!offer_id || !requested_amount) {
    return new Response(JSON.stringify({ error: 'offer_id and requested_amount are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const serviceClient = getServiceClient();

  // Fetch offer details
  const { data: offer, error: offerErr } = await serviceClient
    .from('preapproved_loan_offers')
    .select('*')
    .eq('id', offer_id)
    .eq('is_active', true)
    .maybeSingle();

  if (offerErr || !offer) {
    return new Response(JSON.stringify({ error: 'Offer not found or no longer active' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Get current credit score
  const { data: scoreData } = await serviceClient
    .from('credit_score_history')
    .select('score')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentScore = scoreData?.score || 0;

  if (currentScore < offer.min_credit_score) {
    return new Response(JSON.stringify({ error: 'Your credit score no longer meets the minimum requirement for this offer' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (requested_amount < offer.min_amount || requested_amount > offer.max_amount) {
    return new Response(JSON.stringify({ error: `Amount must be between ${offer.min_amount} and ${offer.max_amount}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Check for existing account at the lending institution
  const { data: existingAccounts } = await serviceClient
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('institution_id', offer.institution_id)
    .eq('is_active', true)
    .limit(1);

  const hasExistingAccount = (existingAccounts || []).length > 0;

  // GATE: if the offer requires an existing account and the user has none,
  // do NOT trigger a hard inquiry — return an onboarding handoff payload.
  if (offer.requires_existing_account && !hasExistingAccount) {
    // Resolve the bank tied to this institution so the consumer app can deep-link
    const { data: bank } = await serviceClient
      .from('banks')
      .select('id, display_name, short_code')
      .eq('institution_id', offer.institution_id)
      .eq('status', 'active')
      .maybeSingle();

    const { data: institution } = await serviceClient
      .from('institutions')
      .select('institution_name')
      .eq('id', offer.institution_id)
      .maybeSingle();

    return new Response(JSON.stringify({
      error: 'account_required',
      code: 'ACCOUNT_REQUIRED',
      message: `You need an account with ${institution?.institution_name || 'this bank'} before applying for this loan.`,
      onboarding: {
        institution_id: offer.institution_id,
        institution_name: institution?.institution_name || null,
        bank_id: bank?.id || null,
        bank_name: bank?.display_name || null,
        bank_short_code: bank?.short_code || null,
        apply_path: bank?.id ? `/bank/${bank.id}/apply` : null,
      },
    }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Log hard inquiry
  const { data: inquiry, error: inqErr } = await serviceClient
    .from('credit_inquiries')
    .insert({
      user_id: user.id,
      inquiry_type: 'hard',
      inquirer_type: 'institution',
      inquirer_name: `Loan Application - ${offer.product_name}`,
      inquirer_id: offer.institution_id,
      purpose: `Pre-approved loan application: ${offer.product_name}`,
      score_impact: -5,
      score_provided: currentScore,
      status: 'completed',
    })
    .select('id')
    .single();

  if (inqErr) throw inqErr;

  // Create application
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
      hard_inquiry_id: inquiry.id,
      has_existing_account: hasExistingAccount,
    })
    .select('id')
    .single();

  if (appErr) throw appErr;

  // Log credit event for the hard check
  try {
    await serviceClient.from('credit_events').insert({
      user_id: user.id,
      event_type: 'HARD_INQUIRY',
      event_time: new Date().toISOString(),
      source: 'preapproved_loan',
      description: `Hard credit check for ${offer.product_name} loan application`,
      value_numeric: -5,
      metadata: { offer_id, application_id: application.id, institution_id: offer.institution_id },
    });
  } catch (_) { /* non-critical */ }

  return new Response(JSON.stringify({
    application_id: application.id,
    status: 'pending_review',
    hard_inquiry_logged: true,
    score_impact: -5,
    message: 'Your application has been submitted. The bank will perform additional checks before making a final decision.',
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
