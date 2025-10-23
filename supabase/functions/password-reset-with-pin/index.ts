import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone_number, otp_code, new_password } = await req.json();

    if (!phone_number || !otp_code || !new_password) {
      return new Response(
        JSON.stringify({ error: 'phone_number, otp_code, and new_password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate password strength
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify OTP for password reset
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('otp_type', 'password_reset')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check expiration
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase
        .from('phone_otp_codes')
        .update({ status: 'expired' })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: 'OTP code has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Mark OTP as verified
    await supabase
      .from('phone_otp_codes')
      .update({ 
        status: 'verified',
        verified_at: new Date().toISOString() 
      })
      .eq('id', otpRecord.id);

    // Get user by phone number
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone_number', phone_number)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      throw new Error('Failed to update password');
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: profile.id,
      _event_type: 'password_reset_with_pin',
      _event_category: 'authentication',
      _metadata: { 
        action: 'password_reset',
        method: 'pin_and_otp' 
      },
    });

    console.log(`Password reset successfully for user: ${profile.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Password reset error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to reset password', details: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
