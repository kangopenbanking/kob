import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { dispute_id, event_type } = body;

    if (!dispute_id || !event_type) {
      return new Response(JSON.stringify({ error: 'dispute_id and event_type required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch dispute with merchant info
    const { data: dispute } = await supabase.from('gateway_disputes').select('*, gateway_merchants(business_name, business_email, user_id)').eq('id', dispute_id).single();
    if (!dispute) {
      return new Response(JSON.stringify({ error: 'dispute_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const merchant = dispute.gateway_merchants as any;
    const disputeRef = dispute.dispute_ref || dispute.id.slice(0, 8);

    // Determine template and variables based on event type
    let email_key = '';
    let variables: Record<string, any> = {
      merchant_name: merchant?.business_name || 'Merchant',
      dispute_ref: disputeRef,
      amount: Number(dispute.amount).toLocaleString(),
      currency: dispute.currency,
    };

    let notif_type = 'info';
    let notif_title = '';
    let notif_message = '';

    switch (event_type) {
      case 'dispute.created':
        email_key = 'dispute_filed_merchant';
        variables.reason = dispute.reason || 'Not specified';
        variables.evidence_due_by = dispute.evidence_due_by ? new Date(dispute.evidence_due_by).toLocaleDateString() : 'N/A';
        notif_type = 'warning';
        notif_title = 'New Dispute Filed';
        notif_message = `A chargeback of ${dispute.currency} ${Number(dispute.amount).toLocaleString()} has been filed. Reason: ${dispute.reason || 'Not specified'}`;
        break;
      case 'dispute.evidence_submitted':
        email_key = 'dispute_evidence_received';
        notif_type = 'info';
        notif_title = 'Evidence Submitted';
        notif_message = `Evidence for dispute ${disputeRef} has been submitted and is under review.`;
        break;
      case 'dispute.resolved':
        email_key = 'dispute_resolved_final';
        variables.outcome = dispute.status === 'won' ? 'Won (in your favor)' : 'Lost';
        variables.resolution_notes = (dispute.evidence_data as any)?.admin_notes || 'No additional notes';
        notif_type = dispute.status === 'won' ? 'success' : 'warning';
        notif_title = `Dispute ${dispute.status === 'won' ? 'Won' : 'Lost'}`;
        notif_message = `Dispute ${disputeRef} for ${dispute.currency} ${Number(dispute.amount).toLocaleString()} has been ${dispute.status === 'won' ? 'resolved in your favor' : 'lost'}.`;
        break;
      case 'dispute.customer_filed':
        email_key = 'dispute_filed_admin';
        notif_type = 'warning';
        notif_title = 'Customer Dispute Filed';
        notif_message = `A customer has filed a dispute for ${dispute.currency} ${Number(dispute.amount).toLocaleString()}`;
        break;
      default:
        return new Response(JSON.stringify({ error: 'unknown_event_type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send merchant notification (email)
    if (merchant?.business_email && email_key) {
      await supabase.functions.invoke('managed-send-email', {
        body: { email_key, recipient_email: merchant.business_email, variables },
      });
    }

    // Send merchant in-app notification
    if (merchant?.user_id && notif_title) {
      await supabase.from('app_notifications').insert({
        user_id: merchant.user_id,
        type: notif_type,
        title: notif_title,
        message: notif_message,
        icon: 'dispute',
        metadata: { dispute_id, event_type, dispute_ref: disputeRef },
      });
    }

    // Send admin alerts for new disputes and escalations
    if (event_type === 'dispute.created' || event_type === 'dispute.customer_filed') {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (admins?.length) {
        // In-app notifications for all admins
        const adminNotifs = admins.map(a => ({
          user_id: a.user_id,
          type: 'warning',
          title: event_type === 'dispute.customer_filed' ? 'Customer Dispute Filed' : 'New Chargeback Alert',
          message: `${merchant?.business_name || 'Unknown'}: ${dispute.currency} ${Number(dispute.amount).toLocaleString()} - ${dispute.reason || 'Chargeback'}`,
          icon: 'dispute',
          metadata: { dispute_id, event_type, dispute_ref: disputeRef },
        }));
        await supabase.from('app_notifications').insert(adminNotifs);

        // Email to first admin
        const { data: profile } = await supabase.from('profiles').select('email').eq('id', admins[0].user_id).single();
        if (profile?.email) {
          await supabase.functions.invoke('managed-send-email', {
            body: {
              email_key: 'dispute_filed_admin',
              recipient_email: profile.email,
              variables: { ...variables, provider: dispute.provider },
            },
          });
        }
      }
    }

    // Log activity
    await supabase.from('dispute_activities').insert({
      dispute_id,
      dispute_source: 'gateway',
      actor_type: 'system',
      action: event_type === 'dispute.created' ? 'status_change' : event_type === 'dispute.evidence_submitted' ? 'evidence_submitted' : 'status_change',
      from_status: event_type === 'dispute.created' ? null : undefined,
      to_status: dispute.status,
      note: notif_message,
      metadata: { event_type },
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: `dispute.${event_type.split('.')[1]}`,
      entity_type: 'gateway_dispute',
      entity_id: dispute_id,
      details: { event_type, dispute_ref: disputeRef, merchant_name: merchant?.business_name },
    });

    return new Response(JSON.stringify({ success: true, event_type, dispute_ref: disputeRef }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] Dispute notification error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
