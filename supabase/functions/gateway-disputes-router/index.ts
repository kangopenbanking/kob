// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const jsonRes = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const errRes = (error: string, status: number, extra?: Record<string, unknown>) =>
  new Response(JSON.stringify({ error, ...extra }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const action = body.action;

    // dispute-notify does not require user auth (called internally)
    if (action === 'notify') return handleDisputeNotify(supabase, body);

    // All other actions require auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errRes('unauthorized', 401);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return errRes('unauthorized', 401);

    switch (action) {
      case 'file': return handleFileDispute(supabase, user, body);
      case 'submit_evidence': return handleSubmitEvidence(supabase, user, body);
      default: return errRes('invalid_action', 400, { valid_actions: ['file', 'submit_evidence', 'notify'] });
    }
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-disputes-router error:`, err);
    return errRes('internal_error', 500, { error_id: errorId });
  }
});

// ─── ACTION: file (was gateway-file-dispute) ───
async function handleFileDispute(supabase: any, user: any, body: any) {
  const { transaction_ref, reason, description, dispute_type, amount, currency, institution_id } = body;
  if (!reason || !dispute_type || !amount) return errRes('reason, dispute_type, and amount are required', 400);

  const validTypes = ['unauthorized', 'duplicate', 'not_received', 'defective', 'wrong_amount', 'other'];
  if (!validTypes.includes(dispute_type)) return errRes('invalid_dispute_type', 400, { valid_types: validTypes });

  if (transaction_ref) {
    const { data: existing } = await supabase.from('disputes').select('id').eq('user_id', user.id).eq('transaction_ref', transaction_ref).in('status', ['open', 'investigating', 'under_review']).maybeSingle();
    if (existing) return errRes('duplicate_dispute', 409, { message: 'An active dispute already exists for this transaction' });
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();

  const { data: dispute, error: insertErr } = await supabase.from('disputes').insert({
    user_id: user.id, institution_id: institution_id || null, dispute_type, reason,
    description: description || null, amount, currency: currency || 'XAF',
    transaction_ref: transaction_ref || null, status: 'open',
  }).select().single();
  if (insertErr) throw insertErr;

  await supabase.from('dispute_activities').insert({
    dispute_id: dispute.id, dispute_source: 'legacy', actor_id: user.id, actor_type: 'customer',
    action: 'status_change', from_status: null, to_status: 'open',
    note: `Dispute filed: ${reason}`, metadata: { dispute_type, transaction_ref },
  });

  const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  if (admins?.length) {
    const notifications = admins.map((a: any) => ({
      user_id: a.user_id, type: 'warning', title: 'New Customer Dispute Filed',
      message: `${profile?.full_name || 'A customer'} filed a ${dispute_type} dispute for ${currency || 'XAF'} ${Number(amount).toLocaleString()}`,
      icon: 'dispute', metadata: { dispute_id: dispute.id, dispute_type },
    }));
    await supabase.from('app_notifications').insert(notifications);
  }

  await supabase.from('app_notifications').insert({
    user_id: user.id, type: 'info', title: 'Dispute Filed Successfully',
    message: `Your ${dispute_type} dispute for ${currency || 'XAF'} ${Number(amount).toLocaleString()} has been submitted. We'll review it within 5 business days.`,
    icon: 'dispute', metadata: { dispute_id: dispute.id },
  });

  if (institution_id) {
    const { data: inst } = await supabase.from('institutions').select('user_id, institution_name, contact_email').eq('id', institution_id).single();
    if (inst) {
      await supabase.from('app_notifications').insert({
        user_id: inst.user_id, type: 'warning', title: 'New Customer Dispute',
        message: `${profile?.full_name || 'A customer'} filed a ${dispute_type.replace(/_/g, ' ')} dispute for ${currency || 'XAF'} ${Number(amount).toLocaleString()}`,
        icon: 'dispute', institution_id, metadata: { dispute_id: dispute.id, dispute_type },
      });
      if (inst.contact_email) {
        await supabase.functions.invoke('managed-send-email', {
          body: { email_key: 'dispute_filed_merchant', recipient_email: inst.contact_email, institution_id, variables: { merchant_name: inst.institution_name || 'Institution', dispute_type: dispute_type.replace(/_/g, ' '), amount: Number(amount).toLocaleString(), currency: currency || 'XAF', reason, dispute_ref: dispute.id.slice(0, 8).toUpperCase() } },
        });
      }
    }
  }

  if (profile?.email) {
    await supabase.functions.invoke('managed-send-email', {
      body: { email_key: 'dispute_filed_customer', recipient_email: profile.email, institution_id: institution_id || null, variables: { customer_name: profile.full_name || 'Customer', dispute_type: dispute_type.replace(/_/g, ' '), amount: Number(amount).toLocaleString(), currency: currency || 'XAF', reason, dispute_ref: dispute.id.slice(0, 8).toUpperCase() } },
    });
  }

  if (admins?.length) {
    const { data: adminProfiles } = await supabase.from('profiles').select('email').in('id', admins.map((a: any) => a.user_id));
    for (const ap of adminProfiles || []) {
      if (ap.email) {
        await supabase.functions.invoke('managed-send-email', {
          body: { email_key: 'dispute_filed_admin', recipient_email: ap.email, variables: { customer_name: profile?.full_name || 'A customer', dispute_type: dispute_type.replace(/_/g, ' '), amount: Number(amount).toLocaleString(), currency: currency || 'XAF', dispute_ref: dispute.id.slice(0, 8).toUpperCase() } },
        });
      }
    }
  }

  await supabase.from('audit_logs').insert({
    action_type: 'dispute.customer_filed', entity_type: 'dispute', entity_id: dispute.id,
    performed_by: user.id, details: { dispute_type, amount, currency: currency || 'XAF', transaction_ref, institution_id },
  });

  return jsonRes({ success: true, dispute_id: dispute.id, dispute_ref: dispute.id.slice(0, 8).toUpperCase() });
}

// ─── ACTION: submit_evidence (was gateway-submit-dispute-evidence) ───
async function handleSubmitEvidence(supabase: any, user: any, body: any) {
  const { dispute_id, evidence } = body;
  if (!dispute_id || !evidence) return errRes('dispute_id and evidence required', 400);

  const { data: dispute } = await supabase.from('gateway_disputes').select('*, gateway_merchants!inner(user_id)').eq('id', dispute_id).single();
  if (!dispute || dispute.gateway_merchants.user_id !== user.id) return errRes('dispute_not_found', 404);

  if (dispute.status !== 'open') return errRes('dispute_not_open', 400, { message: 'Evidence can only be submitted for open disputes' });

  if (dispute.provider === 'stripe' && dispute.provider_ref) {
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (STRIPE_SECRET) {
      const params = new URLSearchParams();
      if (evidence.customer_name) params.append('evidence[customer_name]', evidence.customer_name);
      if (evidence.customer_email) params.append('evidence[customer_email_address]', evidence.customer_email);
      if (evidence.product_description) params.append('evidence[product_description]', evidence.product_description);
      if (evidence.uncategorized_text) params.append('evidence[uncategorized_text]', evidence.uncategorized_text);
      if (evidence.submit !== false) params.append('submit', 'true');
      await fetch(`https://api.stripe.com/v1/disputes/${dispute.provider_ref}`, {
        method: 'POST', headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
      });
    }
  }

  await supabase.from('gateway_disputes').update({ status: 'under_review', evidence_submitted: true, evidence_data: evidence, updated_at: new Date().toISOString() }).eq('id', dispute_id);

  await supabase.functions.invoke('gateway-disputes-router', { body: { action: 'notify', dispute_id, event_type: 'dispute.evidence_submitted' } });

  const { gateway_merchants, ...disputeData } = dispute;
  return jsonRes({ ...disputeData, status: 'under_review' });
}

// ─── ACTION: notify (was gateway-dispute-notify) ───
async function handleDisputeNotify(supabase: any, body: any) {
  const { dispute_id, event_type } = body;
  if (!dispute_id || !event_type) return errRes('dispute_id and event_type required', 400);

  const { data: dispute } = await supabase.from('gateway_disputes').select('*, gateway_merchants(business_name, business_email, user_id)').eq('id', dispute_id).single();
  if (!dispute) return errRes('dispute_not_found', 404);

  const merchant = dispute.gateway_merchants as any;
  const disputeRef = dispute.dispute_ref || dispute.id.slice(0, 8);
  let email_key = '', notif_type = 'info', notif_title = '', notif_message = '';
  const variables: Record<string, any> = { merchant_name: merchant?.business_name || 'Merchant', dispute_ref: disputeRef, amount: Number(dispute.amount).toLocaleString(), currency: dispute.currency };

  switch (event_type) {
    case 'dispute.created':
      email_key = 'dispute_filed_merchant'; variables.reason = dispute.reason || 'Not specified';
      variables.evidence_due_by = dispute.evidence_due_by ? new Date(dispute.evidence_due_by).toLocaleDateString() : 'N/A';
      notif_type = 'warning'; notif_title = 'New Dispute Filed';
      notif_message = `A chargeback of ${dispute.currency} ${Number(dispute.amount).toLocaleString()} has been filed. Reason: ${dispute.reason || 'Not specified'}`;
      break;
    case 'dispute.evidence_submitted':
      email_key = 'dispute_evidence_received'; notif_type = 'info'; notif_title = 'Evidence Submitted';
      notif_message = `Evidence for dispute ${disputeRef} has been submitted and is under review.`;
      break;
    case 'dispute.resolved':
      email_key = 'dispute_resolved_final'; variables.outcome = dispute.status === 'won' ? 'Won (in your favor)' : 'Lost';
      variables.resolution_notes = (dispute.evidence_data as any)?.admin_notes || 'No additional notes';
      notif_type = dispute.status === 'won' ? 'success' : 'warning';
      notif_title = `Dispute ${dispute.status === 'won' ? 'Won' : 'Lost'}`;
      notif_message = `Dispute ${disputeRef} for ${dispute.currency} ${Number(dispute.amount).toLocaleString()} has been ${dispute.status === 'won' ? 'resolved in your favor' : 'lost'}.`;
      break;
    case 'dispute.customer_filed':
      email_key = 'dispute_filed_admin'; notif_type = 'warning'; notif_title = 'Customer Dispute Filed';
      notif_message = `A customer has filed a dispute for ${dispute.currency} ${Number(dispute.amount).toLocaleString()}`;
      break;
    default: return errRes('unknown_event_type', 400);
  }

  if (merchant?.business_email && email_key) {
    await supabase.functions.invoke('managed-send-email', { body: { email_key, recipient_email: merchant.business_email, variables } });
  }
  if (merchant?.user_id && notif_title) {
    await supabase.from('app_notifications').insert({ user_id: merchant.user_id, type: notif_type, title: notif_title, message: notif_message, icon: 'dispute', metadata: { dispute_id, event_type, dispute_ref: disputeRef } });
  }
  if (event_type === 'dispute.created' || event_type === 'dispute.customer_filed') {
    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
    if (admins?.length) {
      const adminNotifs = admins.map((a: any) => ({ user_id: a.user_id, type: 'warning', title: event_type === 'dispute.customer_filed' ? 'Customer Dispute Filed' : 'New Chargeback Alert', message: `${merchant?.business_name || 'Unknown'}: ${dispute.currency} ${Number(dispute.amount).toLocaleString()} - ${dispute.reason || 'Chargeback'}`, icon: 'dispute', metadata: { dispute_id, event_type, dispute_ref: disputeRef } }));
      await supabase.from('app_notifications').insert(adminNotifs);
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', admins[0].user_id).single();
      if (profile?.email) {
        await supabase.functions.invoke('managed-send-email', { body: { email_key: 'dispute_filed_admin', recipient_email: profile.email, variables: { ...variables, provider: dispute.provider } } });
      }
    }
  }

  await supabase.from('dispute_activities').insert({ dispute_id, dispute_source: 'gateway', actor_type: 'system', action: event_type === 'dispute.created' ? 'status_change' : event_type === 'dispute.evidence_submitted' ? 'evidence_submitted' : 'status_change', from_status: event_type === 'dispute.created' ? null : undefined, to_status: dispute.status, note: notif_message, metadata: { event_type } });
  await supabase.from('audit_logs').insert({ action_type: `dispute.${event_type.split('.')[1]}`, entity_type: 'gateway_dispute', entity_id: dispute_id, details: { event_type, dispute_ref: disputeRef, merchant_name: merchant?.business_name } });

  return jsonRes({ success: true, event_type, dispute_ref: disputeRef });
}
