import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

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

    // Verify caller is a merchant
    const { data: merchant } = await supabaseAdmin
      .from('gateway_merchants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!merchant) throw new Error('Only merchants can create staff accounts');

    const {
      staff_name,
      staff_email,
      phone_number,
      password,
      pin_code,
      role,
      permissions,
    } = await req.json();

    if (!staff_name || !staff_email || !password || !pin_code) {
      throw new Error('staff_name, staff_email, password, and pin_code are required');
    }

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(pin_code)) {
      throw new Error('PIN must be exactly 6 digits');
    }

    // Validate password strength (NIST 800-63B aligned: ≥8 chars + mixed case + digit)
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and a digit');
    }

    // Check if staff email already exists in this merchant's staff
    const { data: existingStaff } = await supabaseAdmin
      .from('merchant_staff_roles')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('staff_email', staff_email)
      .maybeSingle();

    if (existingStaff) {
      throw new Error('A staff member with this email already exists');
    }

    // Create auth user for staff (auto-confirm so merchant-set password works immediately)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: staff_email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: staff_name,
        is_merchant_staff: true,
        merchant_id: merchant.id,
      },
    });

    if (createError) {
      // If user already exists, try to get their ID
      if (createError.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === staff_email);
        if (!existingUser) throw new Error('User exists but could not be found');
        
        // Create staff role record with existing user
        const pinHash = await hashPin(pin_code);
        const { data: staffRecord, error: staffError } = await supabaseAdmin
          .from('merchant_staff_roles')
          .insert({
            merchant_id: merchant.id,
            user_id: existingUser.id,
            staff_name,
            staff_email,
            phone_number: phone_number || null,
            pin_hash: pinHash,
            role: role || 'booking_agent',
            permissions: permissions || {},
            invited_by: user.id,
            is_active: true,
          })
          .select()
          .single();

        if (staffError) throw staffError;

        return new Response(
          JSON.stringify({ success: true, staff_id: staffRecord.id, message: 'Existing user linked as staff' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw createError;
    }

    // Hash the PIN using SHA-256
    const pinHash = await hashPin(pin_code);

    // Create staff role record
    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from('merchant_staff_roles')
      .insert({
        merchant_id: merchant.id,
        user_id: newUser.user.id,
        staff_name,
        staff_email,
        phone_number: phone_number || null,
        pin_hash: pinHash,
        role: role || 'booking_agent',
        permissions: permissions || {},
        invited_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (staffError) throw staffError;

    // Create a profile for the staff user
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        full_name: staff_name,
        email: staff_email,
        phone: phone_number || null,
      }, { onConflict: 'id' });

    return new Response(
      JSON.stringify({
        success: true,
        staff_id: staffRecord.id,
        user_id: newUser.user.id,
        message: 'Staff account created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating staff:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = 'kob-staff-pin-salt';
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
