import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Only admins can assign staff');
    }

    const {
      user_id,
      institution_id,
      branch_id,
      position,
      department,
      employment_type,
      start_date,
      end_date
    } = await req.json();

    // Check if assignment already exists
    const { data: existing } = await supabaseAdmin
      .from('staff_assignments')
      .select('id')
      .eq('user_id', user_id)
      .eq('institution_id', institution_id)
      .eq('branch_id', branch_id || null)
      .single();

    if (existing) {
      // Update existing assignment
      const { data, error } = await supabaseAdmin
        .from('staff_assignments')
        .update({
          position,
          department,
          employment_type,
          start_date,
          end_date,
          is_active: true
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          assignment: data,
          message: 'Staff assignment updated'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new assignment
    const { data, error } = await supabaseAdmin
      .from('staff_assignments')
      .insert({
        user_id,
        institution_id,
        branch_id: branch_id || null,
        position,
        department,
        employment_type: employment_type || 'full_time',
        start_date: start_date || new Date().toISOString().split('T')[0],
        end_date,
        assigned_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit event
    await supabaseAdmin.rpc('log_audit_event', {
      _action_type: 'assign_staff',
      _entity_type: 'staff_assignment',
      _entity_id: data.id,
      _details: {
        user_id,
        institution_id,
        branch_id,
        position,
        assigned_by: user.id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        assignment: data,
        message: 'Staff assigned successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error assigning staff:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
