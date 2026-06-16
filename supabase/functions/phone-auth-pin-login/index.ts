import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone_number, pin_code, captcha_session_id } = await req.json();

    if (!phone_number || !pin_code) {
      return new Response(
        JSON.stringify({ error: 'phone_number and pin_code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin_code)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Captcha is optional — PIN lockout (3 attempts → 30-min lock) provides brute-force protection
    if (captcha_session_id) {
      const { data: captchaData } = await supabase
        .from('captcha_challenges')
        .select('status')
        .eq('session_id', captcha_session_id)
        .in('status', ['verified', 'pending'])
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!captchaData) {
        console.warn('Captcha session not found or expired, proceeding with PIN lockout protection');
      }
    }

    // Get profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, pin_code_hash, pin_attempts, pin_locked_until')
      .eq('phone_number', phone_number)
      .single();

    if (profileError || !profile) {
      console.log('No account found for phone:', phone_number);
      return new Response(
        JSON.stringify({ error: 'No account found with this phone number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!profile.pin_code_hash) {
      return new Response(
        JSON.stringify({ error: 'No PIN code set for this account', no_pin: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if account is locked
    if (profile.pin_locked_until && new Date(profile.pin_locked_until) > new Date()) {
      const minutesRemaining = Math.ceil(
        (new Date(profile.pin_locked_until).getTime() - Date.now()) / (60 * 1000)
      );
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Account locked. Try again in ${minutesRemaining} minutes.`,
          locked_until: profile.pin_locked_until,
          remaining_attempts: 0,
          locked: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Verify PIN (salted SHA-256 format: s2$<saltHex>$<hashHex>)
    let pinValid = false;
    const stored = profile.pin_code_hash as string;
    if (stored.startsWith('s2$')) {
      const parts = stored.split('$');
      const saltHex = parts[1];
      const storedHashHex = parts[2];
      const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      const encoder = new TextEncoder();
      const pinBytes = encoder.encode(pin_code);
      const toHash = new Uint8Array(salt.length + pinBytes.length);
      toHash.set(salt, 0);
      toHash.set(pinBytes, salt.length);
      const digest = await crypto.subtle.digest('SHA-256', toHash);
      const computedHashHex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      
      pinValid = computedHashHex === storedHashHex;
    } else {
      console.warn('Unsupported PIN hash format for user:', profile.id);
      pinValid = false;
    }

    if (pinValid) {
      // Reset attempts
      await supabase
        .from('profiles')
        .update({ pin_attempts: 0, pin_locked_until: null })
        .eq('id', profile.id);

      // Get user info for session creation
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(profile.id);
      if (authError || !authData.user) {
        console.error('Failed to get user for session:', authError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Generate magic link and verify server-side to get a real session.
      // Prefer the auth user's actual email; fall back to the canonical
      // {kang_id}@kang.id placeholder used by all newly-provisioned accounts.
      let userEmail = authData.user.email as string | undefined;
      if (!userEmail) {
        const { data: kangRow } = await supabase
          .from('profiles')
          .select('kang_id')
          .eq('id', profile.id)
          .maybeSingle();
        const kangId = (kangRow as any)?.kang_id as string | undefined;
        userEmail = kangId
          ? `${kangId.toLowerCase()}@kang.id`
          : `${profile.id}@kang.id`;
      }
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
      });

      if (linkError) {
        console.error('Failed to generate magic link:', linkError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Verify the OTP server-side to get a session (same pattern as staff-pin-login)
      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });

      if (sessionError) {
        console.error('Failed to verify OTP for session:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Log success
      try {
        await supabase.rpc('log_security_event', {
          _user_id: profile.id,
          _event_type: 'pin_login_success',
          _event_category: 'authentication',
          _metadata: { action: 'pin_login', method: 'pin' },
        });
      } catch (logErr) {
        console.warn('Failed to log security event:', logErr);
      }

      console.log(`PIN login successful for user: ${profile.id}`);

      // Return BOTH the server-verified session AND the raw token_hash so the
      // browser can re-run verifyOtp locally. The local verifyOtp writes the
      // session into the browser's auth storage cleanly (correct sub claim,
      // correct refresh-token rotation) and avoids the "missing sub claim"
      // 403s we saw when relying solely on the JSON-transported session.
      return new Response(
        JSON.stringify({
          success: true,
          message: 'PIN login successful',
          user_id: profile.id,
          email: userEmail,
          token_hash: linkData.properties.hashed_token,
          session: sessionData.session,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } else {
      // Increment attempts
      const newAttempts = (profile.pin_attempts || 0) + 1;
      const updateData: any = { pin_attempts: newAttempts };

      // Lock account after 3 failed attempts for 30 minutes
      if (newAttempts >= 3) {
        updateData.pin_locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }

      await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      // Log failure
      try {
        await supabase.rpc('log_security_event', {
          _user_id: profile.id,
          _event_type: 'pin_login_failed',
          _event_category: 'authentication',
          _metadata: { action: 'pin_login', attempts: newAttempts },
        });
      } catch (logErr) {
        console.warn('Failed to log security event:', logErr);
      }

      console.log(`PIN login failed for user: ${profile.id}, attempts: ${newAttempts}`);

      const remainingAttempts = 3 - newAttempts;

      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid PIN code',
          remaining_attempts: Math.max(0, remainingAttempts),
          locked: newAttempts >= 3,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

  } catch (error) {
    console.error('PIN login error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An internal error occurred. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
