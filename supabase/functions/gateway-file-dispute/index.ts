import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { transaction_ref, reason, description, dispute_type, amount, currency, institution_id } = body;

    if (!reason || !dispute_type || !amount) {
      return new Response(JSON.stringify({ error: 'reason, dispute_type, and amount are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validTypes = ['unauthorized', 'duplicate', 'not_received', 'defective', 'wrong_amount', 'other'];
    if (!validTypes.includes(dispute_type)) {
      return new Response(JSON.stringify({ error: 'invalid_dispute_type', valid_types: validTypes }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for duplicate dispute on same transaction
    if (transaction_ref) {
      const { data: existing } = await supabase.from('disputes')
        .select('id').eq('user_id', user.id).eq('transaction_ref', transaction_ref)
        .in('status', ['open', 'investigating', 'under_review']).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: 'duplicate_dispute', message: 'An active dispute already exists for this transaction' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Get user profile for name
    const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();

    // Create dispute
    const { data: dispute, error: insertErr } = await supabase.from('disputes').insert({
      user_id: user.id,
      institution_id: institution_id || null,
      dispute_type,
      reason,
      description: description || null,
      amount,
      currency: currency || 'XAF',
      transaction_ref: transaction_ref || null,
      status: 'open',
    }).select().single();

    if (insertErr) throw insertErr;

    // Log activity
    await supabase.from('dispute_activities').insert({
      dispute_id: dispute.id,
      dispute_source: 'legacy',
      actor_id: user.id,
      actor_type: 'customer',
      action: 'status_change',
      from_status: null,
      to_status: 'open',
      note: `Dispute filed: ${reason}`,
      metadata: { dispute_type, transaction_ref },
    });

    // Send in-app notification to admins
    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
    if (admins?.length) {
      const notifications = admins.map(a => ({
        user_id: a.user_id,
        type: 'warning',
        title: 'New Customer Dispute Filed',
        message: `${profile?.full_name || 'A customer'} filed a ${dispute_type} dispute for ${currency || 'XAF'} ${Number(amount).toLocaleString()}`,
        icon: 'dispute',
        metadata: { dispute_id: dispute.id, dispute_type },
      }));
      await supabase.from('app_notifications').insert(notifications);
    }

    // Send confirmation notification to user
    await supabase.from('app_notifications').insert({
      user_id: user.id,
      type: 'info',
      title: 'Dispute Filed Successfully',
      message: `Your ${dispute_type} dispute for ${currency || 'XAF'} ${Number(amount).toLocaleString()} has been submitted. We'll review it within 5 business days.`,
      icon: 'dispute',
      metadata: { dispute_id: dispute.id },
    });

    // Notify institution if institution_id is provided
    if (institution_id) {
      const { data: inst } = await supabase.from('institutions').select('user_id, institution_name, contact_email').eq('id', institution_id).single();
      if (inst) {
        // In-app notification to institution owner
        await supabase.from('app_notifications').insert({
          user_id: inst.user_id,
          type: 'warning',
          title: 'New Customer Dispute',
          message: `${profile?.full_name || 'A customer'} filed a ${dispute_type.replace(/_/g, ' ')} dispute for ${currency || 'XAF'} ${Number(amount).toLocaleString()}`,
          icon: 'dispute',
          institution_id: institution_id,
          metadata: { dispute_id: dispute.id, dispute_type },
        });

        // Email to institution
        if (inst.contact_email) {
          await supabase.functions.invoke('managed-send-email', {
            body: {
              email_key: 'dispute_filed_merchant',
              recipient_email: inst.contact_email,
              institution_id,
              variables: {
                merchant_name: inst.institution_name || 'Institution',
                dispute_type: dispute_type.replace(/_/g, ' '),
                amount: Number(amount).toLocaleString(),
                currency: currency || 'XAF',
                reason,
                dispute_ref: dispute.id.slice(0, 8).toUpperCase(),
              },
            },
          });
        }
      }
    }

    // Send email notifications to customer
    if (profile?.email) {
      await supabase.functions.invoke('managed-send-email', {
        body: {
          email_key: 'dispute_filed_customer',
          recipient_email: profile.email,
          institution_id: institution_id || null,
          variables: {
            customer_name: profile.full_name || 'Customer',
            dispute_type: dispute_type.replace(/_/g, ' '),
            amount: Number(amount).toLocaleString(),
            currency: currency || 'XAF',
            reason,
            dispute_ref: dispute.id.slice(0, 8).toUpperCase(),
          },
        },
      });
    }

    // Email to admins
    if (admins?.length) {
      const { data: adminProfiles } = await supabase.from('profiles').select('email').in('id', admins.map(a => a.user_id));
      for (const ap of adminProfiles || []) {
        if (ap.email) {
          await supabase.functions.invoke('managed-send-email', {
            body: {
              email_key: 'dispute_filed_admin',
              recipient_email: ap.email,
              variables: {
                customer_name: profile?.full_name || 'A customer',
                dispute_type: dispute_type.replace(/_/g, ' '),
                amount: Number(amount).toLocaleString(),
                currency: currency || 'XAF',
                dispute_ref: dispute.id.slice(0, 8).toUpperCase(),
              },
            },
          });
        }
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'dispute.customer_filed',
      entity_type: 'dispute',
      entity_id: dispute.id,
      performed_by: user.id,
      details: { dispute_type, amount, currency: currency || 'XAF', transaction_ref, institution_id },
    });

    return new Response(JSON.stringify({ success: true, dispute_id: dispute.id, dispute_ref: dispute.id.slice(0, 8).toUpperCase() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-file-dispute error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
