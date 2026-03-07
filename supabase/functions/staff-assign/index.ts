import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const PORTAL_SECTIONS = [
  'dashboard', 'analytics', 'accounts', 'customer-onboarding', 'branches',
  'loans', 'savings', 'customers', 'transactions', 'payments', 'settlement',
  'beneficiaries', 'ledger', 'billing', 'exchange-rates', 'staff', 'incidents',
  'alerts', 'api-clients', 'webhooks', 'credit-api', 'woocommerce', 'consents',
  'audit', 'compliance', 'regulatory', 'messaging', 'profile', 'team', 'settings'
];

const ROLE_TEMPLATES: Record<string, string[]> = {
  teller: ['dashboard', 'accounts', 'transactions', 'customers', 'payments'],
  branch_manager: ['dashboard', 'accounts', 'customer-onboarding', 'branches', 'loans', 'savings', 'customers', 'transactions', 'payments', 'staff', 'incidents'],
  compliance_officer: ['dashboard', 'regulatory', 'audit', 'compliance', 'incidents', 'customers', 'consents'],
  loan_officer: ['dashboard', 'loans', 'customers', 'accounts', 'ledger'],
  it_api_manager: ['dashboard', 'api-clients', 'webhooks', 'credit-api', 'woocommerce', 'settings'],
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

    // Validate caller
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const {
      user_id,
      institution_id,
      branch_id,
      position,
      department,
      employment_type,
      start_date,
      role_template,
      sections,
    } = body;

    if (!user_id || !institution_id || !position) {
      throw new Error('user_id, institution_id, and position are required');
    }

    // Verify caller is owner or admin
    const { data: inst } = await supabaseAdmin
      .from('institutions')
      .select('user_id')
      .eq('id', institution_id)
      .single();

    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isOwner = inst?.user_id === user.id;
    const isAdmin = callerRoles?.some(r => r.role === 'admin');
    
    if (!isOwner && !isAdmin) {
      throw new Error('Only institution owners or admins can assign staff');
    }

    // Determine sections to grant
    let grantedSections: string[] = [];
    if (role_template && ROLE_TEMPLATES[role_template]) {
      grantedSections = ROLE_TEMPLATES[role_template];
    } else if (sections && Array.isArray(sections)) {
      grantedSections = sections.filter((s: string) => PORTAL_SECTIONS.includes(s));
    }

    // Create or update staff assignment
    const { data: existing } = await supabaseAdmin
      .from('staff_assignments')
      .select('id')
      .eq('user_id', user_id)
      .eq('institution_id', institution_id)
      .maybeSingle();

    let assignmentId: string;

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('staff_assignments')
        .update({
          position,
          department: department || null,
          branch_id: branch_id || null,
          employment_type: employment_type || 'full_time',
          is_active: true,
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      if (error) throw error;
      assignmentId = data.id;
    } else {
      const { data, error } = await supabaseAdmin
        .from('staff_assignments')
        .insert({
          user_id,
          institution_id,
          branch_id: branch_id || null,
          position,
          department: department || null,
          employment_type: employment_type || 'full_time',
          start_date: start_date || new Date().toISOString().split('T')[0],
          assigned_by: user.id,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      assignmentId = data.id;
    }

    // Assign 'staff' role to the user
    await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id, role: 'staff' }, { onConflict: 'user_id,role' });

    // Clear existing permissions and set new ones
    await supabaseAdmin
      .from('staff_portal_permissions')
      .delete()
      .eq('staff_assignment_id', assignmentId);

    if (grantedSections.length > 0) {
      const permissionRows = grantedSections.map(section => ({
        staff_assignment_id: assignmentId,
        section_key: section,
        can_view: true,
        can_manage: role_template === 'branch_manager' || sections?.includes(section),
        granted_by: user.id,
      }));

      const { error: permError } = await supabaseAdmin
        .from('staff_portal_permissions')
        .insert(permissionRows);
      if (permError) throw permError;
    }

    // Log audit event
    await supabaseAdmin.rpc('log_audit_event', {
      _action_type: 'assign_staff',
      _entity_type: 'staff_assignment',
      _entity_id: assignmentId,
      _details: {
        user_id,
        institution_id,
        branch_id,
        position,
        role_template,
        sections: grantedSections,
        assigned_by: user.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        assignment_id: assignmentId,
        sections: grantedSections,
        message: 'Staff assigned with portal permissions',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in staff-assign:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
