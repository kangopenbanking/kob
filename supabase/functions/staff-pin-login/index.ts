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

    const { phone_number, pin_code } = await req.json();

    if (!phone_number || !pin_code) {
      throw new Error('Phone number and PIN are required');
    }

    if (!/^\d{6}$/.test(pin_code)) {
      throw new Error('PIN must be exactly 6 digits');
    }

    // Hash the provided PIN
    const pinHash = await hashPin(pin_code);

    // Look up staff by phone number and PIN
    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from('merchant_staff_roles')
      .select('*, gateway_merchants!inner(business_name)')
      .eq('phone_number', phone_number)
      .eq('pin_hash', pinHash)
      .eq('is_active', true)
      .maybeSingle();

    if (staffError) throw staffError;

    if (!staffRecord) {
      throw new Error('Invalid phone number or PIN');
    }

    // Get the staff user's email to generate a session
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(staffRecord.user_id);
    if (userError || !user) throw new Error('Staff account not found');

    // Generate a magic link token for the staff user (creates a session)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
    });

    if (linkError) throw linkError;

    // Extract token from the link
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get('token') || url.hash?.split('token=')[1]?.split('&')[0];

    // Verify the OTP to get a session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData.session,
        staff: {
          id: staffRecord.id,
          name: staffRecord.staff_name,
          role: staffRecord.role,
          permissions: staffRecord.permissions,
          merchant_name: (staffRecord as any).gateway_merchants?.business_name,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Staff PIN login error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
