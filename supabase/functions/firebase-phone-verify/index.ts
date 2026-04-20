import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firebase_id_token } = await req.json();

    if (!firebase_id_token) {
      return new Response(
        JSON.stringify({ error: 'firebase_id_token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify the Firebase ID token by calling Google's token info endpoint
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID')!;
    
    // Verify token with Google's public keys
    const verifyUrl = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${Deno.env.get('FIREBASE_API_KEY')}`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: firebase_id_token }),
    });

    if (!verifyRes.ok) {
      console.error('Firebase token verification failed:', await verifyRes.text());
      return new Response(
        JSON.stringify({ error: 'Invalid Firebase token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const verifyData = await verifyRes.json();
    const firebaseUser = verifyData.users?.[0];

    if (!firebaseUser?.phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'No phone number in Firebase token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const phoneNumber = firebaseUser.phoneNumber;

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up user by phone number in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, phone_number')
      .eq('phone_number', phoneNumber)
      .single();

    let userId: string;
    let userEmail: string;

    if (profile) {
      // Existing user found by phone in profiles
      userId = profile.id;
      userEmail = profile.email || `${phoneNumber.replace('+', '')}@phone.kob.cm`;
    } else {
      // No profile with this phone — check if auth user already exists with this email
      const tempEmail = `${phoneNumber.replace('+', '')}@phone.kob.cm`;

      // Try to find existing auth user by email or phone
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        u => u.email === tempEmail || u.phone === phoneNumber
      );

      if (existingUser) {
        // Auth user exists but profile didn't have phone_number set
        userId = existingUser.id;
        userEmail = tempEmail;

        // Ensure profile has phone number (UPSERT to handle missing profiles)
        await supabase
          .from('profiles')
          .upsert({ id: userId, phone_number: phoneNumber }, { onConflict: 'id' });
      } else {
        // Truly new user: create auth user + profile
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: tempEmail,
          email_confirm: true,
          user_metadata: { phone_number: phoneNumber, auth_method: 'firebase_phone' },
        });

        if (createError) {
          // Handle phone_exists or email conflict: user was registered via another flow
          const { data: retryUsers } = await supabase.auth.admin.listUsers();
          const fallbackUser = retryUsers?.users?.find(
            u => u.phone === phoneNumber || u.email === tempEmail
          );
          if (fallbackUser) {
            userId = fallbackUser.id;
            userEmail = fallbackUser.email || tempEmail;
            await supabase.from('profiles').update({ phone_number: phoneNumber }).eq('id', userId);
          } else {
            console.error('Failed to create user:', createError);
            return new Response(
              JSON.stringify({ error: 'Failed to create user account' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        } else {
          userId = newUser.user.id;
          userEmail = tempEmail;

    // UPSERT profile with phone number (ensures profile exists even if trigger didn't fire)
          await supabase
            .from('profiles')
            .upsert({ id: userId, phone_number: phoneNumber }, { onConflict: 'id' });
        }
      }
    }

    // Ensure profile exists for ALL paths (not just new user creation)
    await supabase
      .from('profiles')
      .upsert({ id: userId, phone_number: phoneNumber }, { onConflict: 'id' });

    // Generate magic link and verify server-side to get session tokens
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkError) {
      console.error('Failed to generate link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Verify OTP server-side using hashed_token to mint a real session.
    // Use 'magiclink' type — matches the generateLink type above and the
    // working pattern in phone-auth-pin-login / staff-pin-login.
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (sessionError || !sessionData.session) {
      console.error('Failed to verify OTP server-side:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: userId,
      _event_type: 'firebase_phone_login',
      _event_category: 'authentication',
      _metadata: { method: 'firebase_phone_otp', phone: phoneNumber },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Firebase phone verify error:', error);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
