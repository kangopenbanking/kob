import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
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

    // Rate limit: max 10 verify attempts per phone per 10 minutes
    const rateLimitOk = await supabase.rpc('check_rate_limit', {
      _client_id: phone_number,
      _endpoint: 'phone-auth-verify-otp',
      _limit: 10,
      _window_minutes: 10,
    });
    if (!rateLimitOk?.data) {
      return new Response(
        JSON.stringify({ error: 'Too many verification attempts. Please wait before trying again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Lookup OTP by phone + type only (NOT by otp_code) to enable attempt tracking
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_type', otp_type)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP code', verified: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check expiration
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase
        .from('phone_otp_codes')
        .update({ status: 'expired' })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: 'OTP code has expired', verified: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Increment attempts on EVERY verification attempt (before checking code)
    const newAttempts = (otpRecord.attempts || 0) + 1;
    await supabase
      .from('phone_otp_codes')
      .update({ attempts: newAttempts })
      .eq('id', otpRecord.id);

    // Check if max attempts exceeded
    if (newAttempts > (otpRecord.max_attempts || 5)) {
      await supabase
        .from('phone_otp_codes')
        .update({ status: 'failed' })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: 'Maximum verification attempts exceeded. Please request a new OTP.', verified: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Hash the submitted OTP and compare against stored hash
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(otp_code));
    const inputHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const codeMatch = otpRecord.otp_code === inputHash;
    if (!codeMatch) {
      const remaining = (otpRecord.max_attempts || 5) - newAttempts;
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP code', verified: false, remaining_attempts: remaining }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let authData: any;

    if (otp_type === 'signup') {
      // Create or link user with phone number; email optional (can be added later)
      if (!full_name) {
        return new Response(
          JSON.stringify({ error: 'full_name is required for signup' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Use a phone-derived bootstrap placeholder for initial signup; we'll
      // rewrite it to the canonical {kang_id}@kang.id placeholder right after
      // createUser so the email is unique, stable, and tied to the user's
      // permanent KANG ID. The `temp.kob.cm` domain is no longer used.
      const userEmail = email || `${phone_number.replace(/[^0-9]/g, '')}@kang.id`;

      // Pre-check if phone already exists; if yes, treat as login
      let targetUserId: string | undefined;
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phone_number)
        .single();

      if (existingProfile) {
        // Mark phone verified and continue as login
        await supabase
          .from('profiles')
          .update({
            phone_number,
            phone_verified: true,
            phone_verified_at: new Date().toISOString(),
            country_code: country_code || '+237',
            migration_required: false,
          })
          .eq('id', existingProfile.id);

        const { data: userData } = await supabase.auth.admin.getUserById(existingProfile.id);
        authData = userData;
        targetUserId = existingProfile.id;
        console.log(`Phone already registered, treating as login: ${phone_number}`);
      } else {
        const { data: signupData, error: signupError }: any = await supabase.auth.admin.createUser({
          phone: phone_number,
          phone_confirm: true,
          email: userEmail,
          email_confirm: email ? true : false,
          user_metadata: {
            full_name,
            phone_number,
            country_code: country_code || '+237',
          },
        });

        if (signupError) {
          console.error('Signup error:', signupError);
          const msg = (signupError.message || '').toLowerCase();
          if (msg.includes('phone number already registered') || signupError.code === 'phone_exists') {
            return new Response(
              JSON.stringify({
                error: 'phone_exists',
                message: 'This phone number is already registered. Please switch to Login.',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
            );
          }
          if (msg.includes('email') && msg.includes('registered')) {
            return new Response(
              JSON.stringify({
                error: 'email_exists',
                message: 'This email is already registered. Please use a different email or log in.',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
            );
          }
          return new Response(
            JSON.stringify({ error: 'Failed to create user' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Update profile with phone verification for new user
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

        authData = signupData;
        targetUserId = signupData.user.id;

        // Normalize placeholder email to {kang_id}@kang.id so it is unique,
        // human-friendly and tied to the user's permanent KANG ID. The KANG ID
        // is auto-assigned by a DB trigger when handle_new_user inserts the
        // profile row, so it is always available here.
        if (!email && targetUserId) {
          const { data: kangRow } = await supabase
            .from('profiles')
            .select('kang_id')
            .eq('id', targetUserId)
            .maybeSingle();

          const kangId = (kangRow as any)?.kang_id as string | undefined;
          if (kangId) {
            const canonicalEmail = `${kangId.toLowerCase()}@kang.id`;
            const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
              targetUserId,
              { email: canonicalEmail, email_confirm: true }
            );
            if (emailUpdateError) {
              console.warn('Failed to normalize placeholder email (non-blocking):', emailUpdateError);
            } else {
              await supabase.from('profiles').update({ email: canonicalEmail }).eq('id', targetUserId);
            }
          } else {
            console.warn('No kang_id found for new user; placeholder email left as phone-derived');
          }
        }

        console.log(`User created successfully: ${phone_number}`);
      }

      // Set PIN code if provided (use Web Crypto with salted SHA-256)
      if (pin_code && pin_code.length === 6 && targetUserId) {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const pinBytes = encoder.encode(pin_code);
        const toHash = new Uint8Array(salt.length + pinBytes.length);
        toHash.set(salt, 0);
        toHash.set(pinBytes, salt.length);
        const digest = await crypto.subtle.digest('SHA-256', toHash);
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
        const pinHash = `s2$${saltHex}$${hashHex}`;

        await supabase
          .from('profiles')
          .update({
            pin_code_hash: pinHash,
            pin_code_set_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);
      }

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

      // Generate auth session (not created here; client remains responsible for session)
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

    // Mark OTP as verified now that process succeeded
    await supabase
      .from('phone_otp_codes')
      .update({ 
        status: 'verified',
        verified_at: new Date().toISOString() 
      })
      .eq('id', otpRecord.id);

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
      JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
