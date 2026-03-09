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
    let template_key = '';
    let variables: Record<string, any> = {
      merchant_name: merchant?.business_name || 'Merchant',
      dispute_ref: disputeRef,
      amount: dispute.amount,
      currency: dispute.currency,
    };

    switch (event_type) {
      case 'dispute.created':
        template_key = 'dispute_created';
        variables.reason = dispute.reason || 'Not specified';
        variables.evidence_due_by = dispute.evidence_due_by ? new Date(dispute.evidence_due_by).toLocaleDateString() : 'N/A';
        break;
      case 'dispute.evidence_submitted':
        template_key = 'dispute_evidence_submitted';
        break;
      case 'dispute.resolved':
        template_key = 'dispute_resolved';
        variables.outcome = dispute.status === 'won' ? 'Won (in your favor)' : 'Lost';
        variables.resolution_notes = (dispute.evidence_data as any)?.admin_notes || 'No additional notes';
        break;
      default:
        return new Response(JSON.stringify({ error: 'unknown_event_type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send merchant notification
    if (merchant?.business_email) {
      await supabase.functions.invoke('send-communication', {
        body: { template_key, recipient_email: merchant.business_email, variables },
      });
    }

    // Send admin alert for new disputes
    if (event_type === 'dispute.created') {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (admins?.length) {
        for (const admin of admins) {
          const { data: profile } = await supabase.from('profiles').select('email').eq('id', admin.user_id).single();
          if (profile?.email) {
            await supabase.functions.invoke('send-communication', {
              body: {
                template_key: 'dispute_admin_alert',
                recipient_email: profile.email,
                variables: { ...variables, provider: dispute.provider },
              },
            });
          }
        }
      }
    }

    // Log audit event
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
