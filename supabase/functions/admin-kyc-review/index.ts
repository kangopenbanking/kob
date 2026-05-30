import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    // Verify caller has admin role OR institution role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'institution']);

    const isAdmin = roles?.some(r => r.role === 'admin');
    const isInstitution = roles?.some(r => r.role === 'institution');

    if (!isAdmin && !isInstitution) {
      throw new Error('Forbidden: Admin or Institution access required');
    }

    const { kyc_id, action, rejection_reason } = await req.json();

    if (!kyc_id || !['approved', 'rejected'].includes(action)) {
      throw new Error('kyc_id and valid action (approved/rejected) required');
    }

    if (action === 'rejected' && !rejection_reason) {
      throw new Error('Rejection reason is required');
    }

    // Get the KYC record
    const { data: kyc, error: kycFetchError } = await supabaseAdmin
      .from('kyc_verifications')
      .select('*, profiles(full_name, email)')
      .eq('id', kyc_id)
      .single();

    if (kycFetchError || !kyc) throw new Error('KYC record not found');

    if (kyc.status !== 'pending') {
      throw new Error(`KYC is already ${kyc.status}`);
    }

    // If institution user, verify they have access to this customer
    if (isInstitution && !isAdmin) {
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

      if (!institutionId) throw new Error('No institution found for user');

      // Check customer has account at this institution
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('user_id', kyc.user_id)
        .eq('institution_id', institutionId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!account) throw new Error('Customer does not belong to your institution');
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

    const { error: updateError } = await supabaseAdmin
      .from('kyc_verifications')
      .update(updateData)
      .eq('id', kyc_id);

    if (updateError) throw updateError;

    // Log audit
    await supabaseAdmin.from('audit_logs').insert({
      action_type: `kyc_${action}`,
      entity_type: 'kyc_verification',
      entity_id: kyc_id,
      performed_by: user.id,
      details: { action, rejection_reason: rejection_reason || null, user_id: kyc.user_id },
    });

    // Send email notification to customer
    const profile = kyc.profiles as any;
    if (profile?.email) {
      const templateKey = action === 'approved' ? 'kyc_approved' : 'kyc_rejected';
      try {
        await supabaseAdmin.functions.invoke('send-communication', {
          body: {
            template_key: templateKey,
            recipient_email: profile.email,
            recipient_id: kyc.user_id,
            variables: {
              recipient_name: profile.full_name || 'Valued Customer',
              status: action,
              verified_at: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              rejection_reason: rejection_reason || '',
            },
          },
        });
      } catch (emailErr) {
        console.error('Email send failed (non-blocking):', emailErr);
      }
    }

    // Create in-app notification (trigger already exists but let's be explicit)
    await supabaseAdmin.from('app_notifications').insert({
      user_id: kyc.user_id,
      type: action === 'approved' ? 'success' : 'warning',
      title: action === 'approved' ? 'KYC Approved' : 'KYC Rejected',
      message: action === 'approved'
        ? 'Your identity verification has been approved. Full account access is now available.'
        : `Your identity verification was not approved. Reason: ${rejection_reason}`,
      icon: 'kyc',
      metadata: { verification_id: kyc_id, status: action },
    });

    // Send push notification (non-blocking)
    try {
      await supabaseAdmin.functions.invoke('push-notification', {
        body: {
          user_id: kyc.user_id,
          type: action === 'approved' ? 'success' : 'warning',
          title: action === 'approved' ? 'KYC Approved' : 'KYC Action Required',
          message: action === 'approved'
            ? 'Your identity has been verified. Full account access unlocked.'
            : `Verification not approved: ${rejection_reason}`,
          data: { verification_id: kyc_id, status: action, category: 'kyc' },
        },
      });
    } catch (pushErr) {
      console.error('Push notification failed (non-blocking):', pushErr);
    }


    console.log(`KYC ${kyc_id} ${action} by ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: `KYC ${action} successfully` }),
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
