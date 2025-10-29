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

    // Verify admin role
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
      throw new Error('Only admins can create users');
    }

    const {
      email,
      full_name,
      phone_number,
      country_code,
      roles: userRoles,
      institution_id,
      branch_id,
      position,
      department,
      employment_type,
      start_date,
      send_welcome_email
    } = await req.json();

    // Generate temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone_number,
        country_code
      }
    });

    if (createError) throw createError;

    // Create profile
    await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email,
        full_name,
        phone_number,
        country_code
      });

    // Assign roles
    if (userRoles && userRoles.length > 0) {
      const roleInserts = userRoles.map((role: string) => ({
        user_id: newUser.user.id,
        role
      }));
      await supabaseAdmin.from('user_roles').insert(roleInserts);
    }

    // Create staff assignment if institution provided
    if (institution_id) {
      await supabaseAdmin
        .from('staff_assignments')
        .insert({
          user_id: newUser.user.id,
          institution_id,
          branch_id: branch_id || null,
          position: position || 'staff',
          department,
          employment_type: employment_type || 'full_time',
          start_date: start_date || new Date().toISOString().split('T')[0],
          assigned_by: user.id,
          is_active: true
        });
    }

    // Log audit event
    await supabaseAdmin.rpc('log_audit_event', {
      _action_type: 'create_user',
      _entity_type: 'user',
      _entity_id: newUser.user.id,
      _details: {
        email,
        roles: userRoles,
        institution_id,
        branch_id,
        created_by: user.id
      }
    });

    // Send welcome email if requested
    if (send_welcome_email) {
      // This would integrate with your email service
      console.log(`Welcome email would be sent to ${email} with temp password`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          temp_password: send_welcome_email ? undefined : tempPassword
        },
        message: 'User created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
