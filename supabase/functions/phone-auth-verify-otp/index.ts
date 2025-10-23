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

    const { phone_number, otp_code, otp_type, full_name, email, pin_code, country_code } = await req.json();

    if (!phone_number || !otp_code || !otp_type) {
      return new Response(
        JSON.stringify({ error: 'phone_number, otp_code, and otp_type are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('otp_type', otp_type)
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

    // Check attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabase
        .from('phone_otp_codes')
        .update({ status: 'failed' })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: 'Maximum verification attempts exceeded' }),
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

    let authData;

    if (otp_type === 'signup') {
      // Create new user with phone number
      if (!full_name) {
        return new Response(
          JSON.stringify({ error: 'full_name is required for signup' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { data: signupData, error: signupError } = await supabase.auth.admin.createUser({
        phone: phone_number,
        phone_confirm: true,
        email: email || undefined,
        email_confirm: email ? true : false,
        user_metadata: {
          full_name,
          phone_number,
          country_code: country_code || '+237',
        },
      });

      if (signupError) {
        console.error('Signup error:', signupError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user', details: signupError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Update profile with phone verification
      await supabase
        .from('profiles')
        .update({
          phone_number,
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          country_code: country_code || '+237',
          migration_required: false,
        })
        .eq('id', signupData.user.id);

      // Set PIN code if provided
      if (pin_code && pin_code.length === 6) {
        const bcrypt = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts');
        const pinHash = await bcrypt.hash(pin_code);

        await supabase
          .from('profiles')
          .update({
            pin_code_hash: pinHash,
            pin_code_set_at: new Date().toISOString(),
          })
          .eq('id', signupData.user.id);
      }

      // Generate session for new user
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email || `${phone_number.replace(/[^0-9]/g, '')}@temp.kob.cm`,
        options: {
          redirectTo: `${req.headers.get('origin') || 'http://localhost:8080'}/dashboard`,
        },
      });

      if (sessionError) {
        console.error('Session generation error:', sessionError);
      }

      authData = signupData;
      console.log(`User created successfully: ${phone_number}`);

    } else if (otp_type === 'login') {
      // Find existing user by phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phone_number)
        .single();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'No account found with this phone number' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Generate auth session
      const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
      
      if (!userData?.user) {
        return new Response(
          JSON.stringify({ error: 'User account not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      authData = userData;
      console.log(`User logged in successfully: ${phone_number}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `OTP verified successfully for ${otp_type}`,
        user: authData?.user,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('OTP verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to verify OTP', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
