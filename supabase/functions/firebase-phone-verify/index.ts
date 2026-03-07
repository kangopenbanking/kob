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
      // Existing user
      userId = profile.id;
      userEmail = profile.email || `${phoneNumber.replace('+', '')}@phone.kob.cm`;
    } else {
      // New user: create auth user + profile
      const tempEmail = `${phoneNumber.replace('+', '')}@phone.kob.cm`;
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: tempEmail,
        email_confirm: true,
        user_metadata: { phone_number: phoneNumber, auth_method: 'firebase_phone' },
      });

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      userId = newUser.user.id;
      userEmail = tempEmail;

      // Update profile with phone number
      await supabase
        .from('profiles')
        .update({ phone_number: phoneNumber })
        .eq('id', userId);
    }

    // Generate magic link for session
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (sessionError) {
      console.error('Failed to generate session:', sessionError);
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
        magic_link: sessionData.properties.action_link,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Firebase phone verify error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
