import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const VALID_STATUSES = ['open', 'investigating', 'under_review', 'escalated', 'won', 'lost', 'closed', 'resolved', 'rejected'];
const VALID_ACTIONS = ['change_status', 'assign', 'escalate', 'add_note', 'close'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { dispute_id, dispute_source, action, new_status, assignee_id, note, priority } = body;

    if (!dispute_id || !action) {
      return new Response(JSON.stringify({ error: 'dispute_id and action required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: 'invalid_action', valid: VALID_ACTIONS }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const source = dispute_source || 'gateway';
    const table = source === 'gateway' ? 'gateway_disputes' : 'disputes';

    // Fetch current dispute
    const { data: dispute, error: fetchErr } = await supabase.from(table).select('*').eq('id', dispute_id).single();
    if (fetchErr || !dispute) {
      return new Response(JSON.stringify({ error: 'dispute_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const oldStatus = dispute.status;
    let updatedFields: Record<string, any> = { updated_at: new Date().toISOString() };
    let activityAction = action;
    let activityNote = note || '';

    switch (action) {
      case 'change_status':
        if (!new_status || !VALID_STATUSES.includes(new_status)) {
          return new Response(JSON.stringify({ error: 'invalid_status', valid: VALID_STATUSES }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        updatedFields.status = new_status;
        activityAction = 'status_change';
        activityNote = note || `Status changed from ${oldStatus} to ${new_status}`;

        // If resolving, add resolution fields for legacy
        if (source === 'legacy' && ['resolved', 'rejected', 'closed'].includes(new_status)) {
          updatedFields.resolved_at = new Date().toISOString();
          updatedFields.resolved_by = user.id;
          if (note) updatedFields.resolution = note;
        }
        break;

      case 'assign':
        if (!assignee_id) {
          return new Response(JSON.stringify({ error: 'assignee_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (source === 'gateway') updatedFields.assignee_id = assignee_id;
        activityAction = 'assigned';
        // Get assignee name
        const { data: assigneeProfile } = await supabase.from('profiles').select('full_name').eq('id', assignee_id).single();
        activityNote = `Assigned to ${assigneeProfile?.full_name || 'staff member'}`;
        break;

      case 'escalate':
        updatedFields.status = 'escalated';
        if (source === 'gateway') updatedFields.priority = 'high';
        activityAction = 'escalated';
        activityNote = note || 'Dispute escalated for senior review';
        break;

      case 'add_note':
        if (!note) {
          return new Response(JSON.stringify({ error: 'note required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        activityAction = 'note_added';
        break;

      case 'close':
        updatedFields.status = 'closed';
        activityAction = 'status_change';
        activityNote = note || 'Dispute closed';
        if (source === 'legacy') {
          updatedFields.resolved_at = new Date().toISOString();
          updatedFields.resolved_by = user.id;
          if (note) updatedFields.resolution = note;
        }
        break;
    }

    // Update priority if provided
    if (priority && source === 'gateway') updatedFields.priority = priority;

    // Update dispute (only if we have real fields to update)
    if (Object.keys(updatedFields).length > 1) {
      await supabase.from(table).update(updatedFields).eq('id', dispute_id);
    }

    // Log activity
    await supabase.from('dispute_activities').insert({
      dispute_id,
      dispute_source: source,
      actor_id: user.id,
      actor_type: 'admin',
      action: activityAction,
      from_status: activityAction === 'status_change' || activityAction === 'escalated' ? oldStatus : null,
      to_status: updatedFields.status || null,
      note: activityNote,
      metadata: { priority, assignee_id },
    });

    // Send notifications on status changes
    if (updatedFields.status && updatedFields.status !== oldStatus) {
      const statusLabel = updatedFields.status.replace(/_/g, ' ');

      // Notify merchant (gateway disputes)
      if (source === 'gateway') {
        const { data: merchant } = await supabase.from('gateway_merchants').select('user_id, business_name, business_email').eq('id', dispute.merchant_id).single();
        if (merchant) {
          await supabase.from('app_notifications').insert({
            user_id: merchant.user_id,
            type: updatedFields.status === 'won' ? 'success' : updatedFields.status === 'lost' ? 'warning' : 'info',
            title: `Dispute ${statusLabel}`,
            message: `Your dispute for ${dispute.currency} ${Number(dispute.amount).toLocaleString()} has been updated to: ${statusLabel}`,
            icon: 'dispute',
            metadata: { dispute_id, status: updatedFields.status },
          });

          // Send email
          if (merchant.business_email) {
            await supabase.functions.invoke('managed-send-email', {
              body: {
                email_key: 'dispute_status_update',
                recipient_email: merchant.business_email,
                variables: {
                  merchant_name: merchant.business_name || 'Merchant',
                  dispute_ref: dispute.dispute_ref || dispute_id.slice(0, 8),
                  amount: Number(dispute.amount).toLocaleString(),
                  currency: dispute.currency,
                  old_status: oldStatus,
                  new_status: statusLabel,
                  note: activityNote,
                },
              },
            });
          }
        }
      }

      // Notify consumer (legacy disputes)
      if (source === 'legacy' && dispute.user_id) {
        await supabase.from('app_notifications').insert({
          user_id: dispute.user_id,
          type: ['resolved', 'won'].includes(updatedFields.status) ? 'success' : ['rejected', 'lost'].includes(updatedFields.status) ? 'warning' : 'info',
          title: `Dispute Update: ${statusLabel}`,
          message: `Your dispute for ${dispute.currency} ${Number(dispute.amount).toLocaleString()} is now: ${statusLabel}`,
          icon: 'dispute',
          metadata: { dispute_id, status: updatedFields.status },
        });
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: `dispute.${action}`,
      entity_type: source === 'gateway' ? 'gateway_dispute' : 'dispute',
      entity_id: dispute_id,
      performed_by: user.id,
      details: { action, from_status: oldStatus, to_status: updatedFields.status, note: activityNote },
    });

    return new Response(JSON.stringify({ success: true, dispute_id, status: updatedFields.status || oldStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] dispute-lifecycle error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
