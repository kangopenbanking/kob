import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

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

    // Rate limiting - 5 attempts per hour per phone number
    const rateLimitKey = `password_reset_${phone_number}`;
    const { data: rateLimitAllowed, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      _client_id: rateLimitKey,
      _endpoint: 'password-reset-with-pin',
      _limit: 5,
      _window_minutes: 60
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (!rateLimitAllowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many password reset attempts. Please try again later.',
          retry_after: '1 hour'
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          } 
        }
      );
    }

    // Validate password strength using database function
    const { data: isStrongPassword, error: validationError } = await supabase.rpc('validate_password_strength', {
      password: new_password
    });

    if (validationError) {
      console.error('Password validation error:', validationError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate password strength' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!isStrongPassword) {
      return new Response(
        JSON.stringify({ 
          error: 'Password must contain at least 8 characters including uppercase, lowercase, number, and special character'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Lookup OTP by phone + type only — codes are stored as SHA-256 hashes
    // by phone-auth-send-otp, so we must hash the input before comparison.
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
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

    // Track and cap attempts to prevent brute-force on a known-valid OTP record
    const newAttempts = (otpRecord.attempts || 0) + 1;
    await supabase
      .from('phone_otp_codes')
      .update({ attempts: newAttempts })
      .eq('id', otpRecord.id);

    if (newAttempts > (otpRecord.max_attempts || 5)) {
      await supabase
        .from('phone_otp_codes')
        .update({ status: 'failed' })
        .eq('id', otpRecord.id);
      return new Response(
        JSON.stringify({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Hash submitted OTP and compare against stored hash
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(otp_code));
    const inputHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (otpRecord.otp_code !== inputHash) {
      const remaining = (otpRecord.max_attempts || 5) - newAttempts;
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP code', remaining_attempts: Math.max(0, remaining) }),
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
      JSON.stringify({ error: 'Failed to reset password. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
