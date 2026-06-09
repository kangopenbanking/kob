import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";
import { notifyUser } from "../_shared/admin-notify.ts";
import { checkStepUp, recordStepUpDenied, stepUpDeniedResponse } from "../_shared/step-up.ts";

interface KYBVerifyRequest {
  kyb_id: string;
  institution_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !userRole) {
      console.error('Admin role check failed:', roleError);
      throw new Error('Forbidden: Admin access required');
    }

    // Step-up MFA gate.
    const stepUp = checkStepUp(token);
    if (!stepUp.ok) {
      await recordStepUpDenied(supabaseAdmin, {
        user_id: user.id,
        action_type: 'admin_kyb_verify.step_up_denied',
        entity_type: 'business_kyc',
        reason: stepUp.reason ?? 'unknown',
        metadata: { aal: stepUp.aal, age_seconds: stepUp.age_seconds, methods: stepUp.methods },
      });
      return stepUpDeniedResponse(stepUp);
    }

    const { kyb_id, institution_id, action, rejection_reason } = await req.json() as KYBVerifyRequest;

    console.log(`Admin ${user.id} performing ${action} on KYB ${kyb_id} for institution ${institution_id} (step_up aal=${stepUp.aal} age=${stepUp.age_seconds}s)`);

    if (action === 'approve') {
      // Update KYB status
      const { error: kybError } = await supabaseAdmin
        .from('business_kyc')
        .update({ 
          verification_status: 'approved', 
          verified_at: new Date().toISOString(),
          verified_by: user.id
        })
        .eq('id', kyb_id);

      if (kybError) throw kybError;

      // Update institution
      const { error: instError } = await supabaseAdmin
        .from('institutions')
        .update({ 
          verification_step: 'pending_branch',
          kyb_verified_at: new Date().toISOString(),
          kyb_submission_id: kyb_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', institution_id);

      if (instError) throw instError;

      // Update KYB submission verification step
      await supabaseAdmin
        .from('institution_verification_steps')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq('institution_id', institution_id)
        .eq('step_type', 'kyb_submission');

      // Update KYB verification step
      await supabaseAdmin
        .from('institution_verification_steps')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq('institution_id', institution_id)
        .eq('step_type', 'kyb_verification');

      // Log audit event
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'kyb_approved',
          entity_type: 'business_kyc',
          entity_id: kyb_id,
          performed_by: user.id,
          details: { institution_id, action: 'approved' }
        });

      // Get institution info for notifications
      const { data: institution } = await supabaseAdmin
        .from('institutions')
        .select('institution_name, user_id')
        .eq('id', institution_id)
        .single();

      if (institution) {
        // In-app notification for the user
        await notifyUser(supabaseAdmin, {
          user_id: institution.user_id,
          type: 'success',
          title: 'KYB Approved',
          message: `Your business verification for "${institution.institution_name}" has been approved. You can now create your main branch.`,
          icon: 'kyc',
          metadata: { kyb_id, institution_id, decision: 'approved' },
        });

        // Send approval notification email
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', institution.user_id)
          .single();

        if (profile?.email) {
          await supabaseAdmin.functions.invoke('send-communication', {
            body: {
              template_key: 'kyb_approved',
              recipient_email: profile.email,
              variables: {
                recipient_name: profile.full_name || 'Institution Representative',
                institution_name: institution.institution_name
              }
            }
          });
        }
      }

      console.log('KYB approved successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'KYB approved successfully. Institution can now create main branch.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } else if (action === 'reject') {
      if (!rejection_reason) {
        throw new Error('Rejection reason is required');
      }

      // Update KYB status
      const { error: kybError } = await supabaseAdmin
        .from('business_kyc')
        .update({ 
          verification_status: 'rejected',
          rejection_reason,
          verified_by: user.id
        })
        .eq('id', kyb_id);

      if (kybError) throw kybError;

      // Update institution
      const { error: instError } = await supabaseAdmin
        .from('institutions')
        .update({ 
          verification_step: 'rejected',
          status: 'rejected',
          rejection_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', institution_id);

      if (instError) throw instError;

      // Update verification steps
      await supabaseAdmin
        .from('institution_verification_steps')
        .update({ 
          status: 'failed',
          notes: rejection_reason,
          completed_by: user.id
        })
        .eq('institution_id', institution_id)
        .eq('step_type', 'kyb_verification');

      // Log audit event
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'kyb_rejected',
          entity_type: 'business_kyc',
          entity_id: kyb_id,
          performed_by: user.id,
          details: { institution_id, action: 'rejected', reason: rejection_reason }
        });

      // Get institution info for notifications
      const { data: institution } = await supabaseAdmin
        .from('institutions')
        .select('institution_name, user_id')
        .eq('id', institution_id)
        .single();

      if (institution) {
        // In-app notification for the user
        await notifyUser(supabaseAdmin, {
          user_id: institution.user_id,
          type: 'warning',
          title: 'KYB Rejected',
          message: `Your business verification for "${institution.institution_name}" was not approved. Reason: ${rejection_reason}`,
          icon: 'kyc',
          metadata: { kyb_id, institution_id, decision: 'rejected', reason: rejection_reason },
        });

        // Send rejection notification email
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', institution.user_id)
          .single();

        if (profile?.email) {
          await supabaseAdmin.functions.invoke('send-communication', {
            body: {
              template_key: 'kyb_rejected',
              recipient_email: profile.email,
              variables: {
                recipient_name: profile.full_name || 'Institution Representative',
                institution_name: institution.institution_name,
                rejection_reason
              }
            }
          });
        }
      }

      console.log('KYB rejected successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'KYB rejected successfully.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('KYB verification error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process KYB verification',
        details: error.details || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
