import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApprovalRequest {
  institution_id: string;
}

serve(async (req) => {
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

    const { institution_id } = await req.json() as ApprovalRequest;

    console.log(`Admin ${user.id} approving institution ${institution_id}`);

    // Get institution details
    const { data: institution, error: instFetchError } = await supabaseAdmin
      .from('institutions')
      .select('*, user_id')
      .eq('id', institution_id)
      .single();

    if (instFetchError || !institution) {
      throw new Error('Institution not found');
    }

    // Verify institution has main branch
    if (!institution.main_branch_id) {
      throw new Error('Institution must have a main branch before final approval');
    }

    // Verify KYB is approved
    if (!institution.kyb_verified_at) {
      throw new Error('Institution KYB must be approved before final approval');
    }

    // Update institution to fully approved
    const { error: instError } = await supabaseAdmin
      .from('institutions')
      .update({ 
        verification_step: 'approved',
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', institution_id);

    if (instError) throw instError;

    // Complete final approval step
    await supabaseAdmin
      .from('institution_verification_steps')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id
      })
      .eq('institution_id', institution_id)
      .eq('step_type', 'final_approval');

    // Assign institution role to user
    await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: institution.user_id,
        role: 'institution'
      }, { onConflict: 'user_id,role' });

    // Log audit event
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        action_type: 'institution_approved',
        entity_type: 'institution',
        entity_id: institution_id,
        performed_by: user.id,
        details: { 
          institution_name: institution.institution_name,
          institution_type: institution.institution_type
        }
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
          template_key: 'institution_approved',
          recipient_email: profile.email,
          variables: {
            recipient_name: profile.full_name || 'Institution Representative',
            institution_name: institution.institution_name,
            dashboard_url: 'https://kangopenbanking.com/fi-portal'
          }
        }
      });
    }

    console.log('Institution approved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `${institution.institution_name} has been fully approved and can now access all features.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Institution approval error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to approve institution',
        details: error.details || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
