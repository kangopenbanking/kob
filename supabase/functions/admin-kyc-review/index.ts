import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Roles authorised to perform KYC review actions (approve, reject, request more info).
// Platform-wide roles are listed first; `institution` is allowed but constrained to
// its own customers via the scoped check further down.
const PLATFORM_REVIEWER_ROLES = ['admin', 'compliance_officer', 'moderator'] as const;
const ALL_REVIEWER_ROLES = [...PLATFORM_REVIEWER_ROLES, 'institution'] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    // RBAC: caller must hold one of the allowed reviewer roles.
    const { data: roleRows } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ALL_REVIEWER_ROLES as unknown as string[]);

    const callerRoles = new Set((roleRows ?? []).map(r => r.role));
    const isPlatformReviewer = PLATFORM_REVIEWER_ROLES.some(r => callerRoles.has(r));
    const isInstitution = callerRoles.has('institution');

    if (!isPlatformReviewer && !isInstitution) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: KYC review requires an admin, compliance officer, moderator, or institution role.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { kyc_id, action, rejection_reason, info_request_message } = await req.json();

    if (!kyc_id || !['approved', 'rejected', 'info_requested'].includes(action)) {
      return new Response(JSON.stringify({ error: 'kyc_id and a valid action (approved/rejected/info_requested) are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (action === 'rejected' && !rejection_reason?.trim()) {
      return new Response(JSON.stringify({ error: 'Rejection reason is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (action === 'info_requested' && !info_request_message?.trim()) {
      return new Response(JSON.stringify({ error: 'Information request message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Get the KYC record
    const { data: kyc, error: kycFetchError } = await supabaseAdmin
      .from('kyc_verifications')
      .select('*, profiles(full_name, email)')
      .eq('id', kyc_id)
      .single();

    if (kycFetchError || !kyc) {
      return new Response(JSON.stringify({ error: 'KYC record not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    if (kyc.status !== 'pending') {
      return new Response(JSON.stringify({ error: `KYC is already ${kyc.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 });
    }

    // If institution-only user, verify they have access to this customer.
    if (isInstitution && !isPlatformReviewer) {
      const { data: inst } = await supabaseAdmin
        .from('institutions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let institutionId = inst?.id;
      if (!institutionId) {
        const { data: staff } = await supabaseAdmin
          .from('staff_assignments')
          .select('institution_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        institutionId = staff?.institution_id;
      }

      if (!institutionId) {
        return new Response(JSON.stringify({ error: 'No institution found for user' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
      }

      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('user_id', kyc.user_id)
        .eq('institution_id', institutionId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: 'Customer does not belong to your institution' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
      }
    }

    // Update KYC status
    const updateData: Record<string, unknown> = {
      status: action,
      updated_at: new Date().toISOString(),
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    };
    if (action === 'rejected') {
      updateData.rejection_reason = rejection_reason;
    }
    if (action === 'info_requested') {
      // Reuse rejection_reason column to carry the message shown to the user.
      updateData.rejection_reason = info_request_message;
      // Don't lock verified_at for info-requested state.
      updateData.verified_at = null;
      updateData.metadata = {
        ...(kyc.metadata ?? {}),
        info_request_message,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from('kyc_verifications')
      .update(updateData)
      .eq('id', kyc_id);

    if (updateError) throw updateError;

    // Audit log — records WHO reviewed, WHAT action, and the message/reason.
    await supabaseAdmin.from('audit_logs').insert({
      action_type: `kyc_${action}`,
      entity_type: 'kyc_verification',
      entity_id: kyc_id,
      performed_by: user.id,
      details: {
        action,
        rejection_reason: rejection_reason || null,
        info_request_message: info_request_message || null,
        reviewer_roles: Array.from(callerRoles),
        user_id: kyc.user_id,
      },
    });

    const profile = kyc.profiles as { full_name?: string; email?: string } | null;
    const recipientName = profile?.full_name || 'Valued Customer';
    const templateKey =
      action === 'approved' ? 'kyc_approved'
      : action === 'rejected' ? 'kyc_rejected'
      : 'kyc_info_requested';

    // Email notification (non-blocking) — variables intentionally cover both
    // legacy `info_request_notes` and current `info_request_message` keys for
    // backwards-compat with older templates that may still reference the old name.
    if (profile?.email) {
      try {
        await supabaseAdmin.functions.invoke('send-communication', {
          body: {
            template_key: templateKey,
            recipient_email: profile.email,
            recipient_id: kyc.user_id,
            variables: {
              recipient_name: recipientName,
              status: action,
              verified_at: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              rejection_reason: rejection_reason || '',
              info_request_message: info_request_message || '',
              info_request_notes: info_request_message || '',
            },
          },
        });
      } catch (emailErr) {
        console.error('Email send failed (non-blocking):', emailErr);
      }
    }

    // In-app notification — message contains concrete next-step instruction.
    const notifConfig = {
      approved: {
        type: 'success',
        title: 'Identity verification approved',
        message: 'Your identity verification has been approved. Full account access — including transfers, payments and higher limits — is now available.',
      },
      rejected: {
        type: 'warning',
        title: 'Identity verification not approved',
        message: `Your identity verification was not approved. Reason: ${rejection_reason}. Open Identity Verification from your dashboard banner to correct and resubmit.`,
      },
      info_requested: {
        type: 'info',
        title: 'Additional information requested',
        message: `Our reviewer needs more information: ${info_request_message} Open Identity Verification from your dashboard banner to update and resubmit — your account is on hold until you respond.`,
      },
    }[action as 'approved' | 'rejected' | 'info_requested'];

    await supabaseAdmin.from('app_notifications').insert({
      user_id: kyc.user_id,
      type: notifConfig.type,
      title: notifConfig.title,
      message: notifConfig.message,
      icon: 'kyc',
      metadata: { verification_id: kyc_id, status: action },
    });

    // Push notification (non-blocking)
    try {
      await supabaseAdmin.functions.invoke('push-notification', {
        body: {
          user_id: kyc.user_id,
          type: notifConfig.type,
          title: notifConfig.title,
          message: notifConfig.message,
          data: { verification_id: kyc_id, status: action, category: 'kyc' },
        },
      });
    } catch (pushErr) {
      console.error('Push notification failed (non-blocking):', pushErr);
    }

    console.log(`KYC ${kyc_id} ${action} by ${user.id} (roles: ${Array.from(callerRoles).join(',')})`);

    return new Response(
      JSON.stringify({ success: true, message: `KYC ${action} successfully`, reviewer_roles: Array.from(callerRoles) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('KYC review error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process KYC review' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
