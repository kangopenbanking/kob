import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";
import {
  getClientIdentifier,
  softCheckRateLimit,
  tooManyRequestsResponse,
} from "../_shared/soft-rate-limit.ts";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || '';
  const region = req.headers.get('x-vercel-ip-country')
    || req.headers.get('cf-ipcountry')
    || req.headers.get('x-region')
    || 'unknown';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const monitor = createClient(supabaseUrl, supabaseServiceKey);

  const logOtp = async (
    phoneHash: string,
    country: string | null,
    status: 'requested' | 'verified' | 'failed' | 'blocked',
    errorCode: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    try {
      await monitor.rpc('record_otp_request', {
        _ip: clientIp,
        _phone_hash: phoneHash,
        _country: country,
        _region: region,
        _status: status,
        _error_code: errorCode,
        _user_agent: userAgent,
        _metadata: metadata,
      });
    } catch (e) {
      console.error('record_otp_request failed', e);
    }
  };

  try {
    // Abuse-detection gate: refuse if IP is already on the OTP block list.
    const { data: blocked } = await monitor.rpc('is_otp_ip_blocked', { _ip: clientIp });
    if (blocked === true) {
      await logOtp('unknown', null, 'blocked', 'ip_blocked');
      return new Response(
        JSON.stringify({ error: 'ip_blocked', message: 'This IP is temporarily blocked due to suspicious activity.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Soft IP-based limit on phone verify: protects against SMS-pumping fraud.
    const ipId = getClientIdentifier(req, "ip");
    const rl = await softCheckRateLimit(ipId, "firebase-phone-verify", 20, 60);
    if (!rl.allowed) {
      await logOtp('unknown', null, 'blocked', 'rate_limited');
      return tooManyRequestsResponse(corsHeaders, 300);
    }


    const { firebase_id_token } = await req.json();

    if (!firebase_id_token || typeof firebase_id_token !== 'string') {
      return new Response(
        JSON.stringify({ error: 'firebase_id_token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // -------- Replay guard: hash the token and reject reuse. --------
    const tokenBytes = new TextEncoder().encode(firebase_id_token);
    const tokenDigest = await crypto.subtle.digest('SHA-256', tokenBytes);
    const tokenHash = Array.from(new Uint8Array(tokenDigest))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    // Reuse the monitor client initialized at the top.
    const supabase = monitor;

    const { data: replay } = await supabase
      .from('firebase_token_replay_guard')
      .select('token_hash, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (replay) {
      return new Response(
        JSON.stringify({ error: 'token_replayed', message: 'This verification token was already used.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // -------- Verify token with Firebase Identity Toolkit. --------
    const verifyUrl = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${Deno.env.get('FIREBASE_API_KEY')}`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: firebase_id_token }),
    });

    if (!verifyRes.ok) {
      console.error('Firebase token verification failed:', await verifyRes.text());
      await logOtp('unknown', null, 'failed', 'invalid_token');
      return new Response(
        JSON.stringify({ error: 'Invalid Firebase token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const verifyData = await verifyRes.json();
    const firebaseUser = verifyData.users?.[0];

    if (!firebaseUser?.phoneNumber) {
      await logOtp('unknown', null, 'failed', 'no_phone_in_token');
      return new Response(
        JSON.stringify({ error: 'No phone number in Firebase token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const phoneNumber = firebaseUser.phoneNumber;
    const phoneHash = await sha256Hex(phoneNumber);
    const countryCode = phoneNumber.slice(0, Math.min(4, phoneNumber.length));

    // -------- Server-side E.164 validation. --------
    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      await logOtp(phoneHash, countryCode, 'failed', 'invalid_phone_format');
      return new Response(
        JSON.stringify({ error: 'invalid_phone_format', message: 'Phone number is not valid E.164.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // -------- Per-phone lockout: 5 failed attempts → 15 minute lock. --------
    const { data: lockout } = await supabase
      .from('firebase_phone_lockouts')
      .select('failed_attempts, locked_until')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    if (lockout?.locked_until && new Date(lockout.locked_until) > new Date()) {
      const retrySec = Math.ceil((new Date(lockout.locked_until).getTime() - Date.now()) / 1000);
      await logOtp(phoneHash, countryCode, 'blocked', 'phone_locked');
      return new Response(
        JSON.stringify({
          error: 'phone_locked',
          message: 'Too many failed verifications. Please try again later.',
          retry_after_seconds: retrySec,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 423 }
      );
    }


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

    // Record the token hash so it cannot be replayed.
    await supabase.from('firebase_token_replay_guard').insert({
      token_hash: tokenHash,
      user_id: userId,
      phone_number: phoneNumber,
    });

    // Reset any lockout counter for this phone after a successful verification.
    await supabase
      .from('firebase_phone_lockouts')
      .upsert({
        phone_number: phoneNumber,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone_number' });

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: userId,
      _event_type: 'firebase_phone_login',
      _event_category: 'authentication',
      _metadata: { method: 'firebase_phone_otp', phone: phoneNumber, token_hash: tokenHash.slice(0, 12) },
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
