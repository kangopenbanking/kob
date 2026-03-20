import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/errors.ts';
import { sendManagedEmail, getUserEmail, getUserName } from '../_shared/send-managed-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { method, email, phone, password, pin, otp_code, app_context } = body;

    if (!method || !['email_password', 'phone_otp', 'pin'].includes(method)) {
      return new Response(JSON.stringify({ error: 'Invalid method. Must be: email_password, phone_otp, or pin' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let userId: string | null = null;
    let session: any = null;

    switch (method) {
      case 'email_password': {
        if (!email || !password) {
          return new Response(JSON.stringify({ error: 'email and password required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const userClient = createClient(supabaseUrl, anonKey);
        const { data, error } = await userClient.auth.signInWithPassword({ email, password });
        if (error) {
          // Log failed attempt
          await adminClient.from('audit_logs').insert({
            action_type: 'login_failed',
            entity_type: 'user',
            entity_id: '00000000-0000-0000-0000-000000000000',
            details: { method: 'email_password', email, reason: error.message }
          });
          return new Response(JSON.stringify({ error: error.message }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        userId = data.user.id;
        session = data.session;
        break;
      }

      case 'phone_otp': {
        if (!phone || !otp_code) {
          return new Response(JSON.stringify({ error: 'phone and otp_code required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // Delegate to existing phone-auth-verify-otp
        const res = await fetch(`${supabaseUrl}/functions/v1/phone-auth-verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ phone, otp_code })
        });
        const result = await res.json();
        if (!res.ok) {
          return new Response(JSON.stringify(result), {
            status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        userId = result.user_id || result.userId;
        session = result.session;
        break;
      }

      case 'pin': {
        if (!phone || !pin) {
          return new Response(JSON.stringify({ error: 'phone and pin required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // Delegate to existing phone-auth-pin-login
        const res = await fetch(`${supabaseUrl}/functions/v1/phone-auth-pin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ phone, pin })
        });
        const result = await res.json();
        if (!res.ok) {
          return new Response(JSON.stringify(result), {
            status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        userId = result.user_id || result.userId;
        session = result.session;
        break;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check MFA requirement
    const { data: mfaFactors } = await adminClient
      .from('mfa_factors')
      .select('id, type, enabled')
      .eq('user_id', userId)
      .eq('enabled', true);

    const mfaRequired = mfaFactors && mfaFactors.length > 0;
    let challengeId: string | null = null;

    if (mfaRequired) {
      // Create MFA challenge
      const factor = mfaFactors[0];
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(code));
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: challenge } = await adminClient
        .from('mfa_challenges')
        .insert({
          user_id: userId,
          factor_id: factor.id,
          challenge_code_hash: codeHash,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        .select('id')
        .single();

      challengeId = challenge?.id || null;

      // Deliver MFA code via SMS or email based on factor type
      if (factor.type === 'sms' || factor.type === 'phone') {
        // Get user phone from profiles
        const { data: profile } = await adminClient.from('profiles').select('phone').eq('id', userId).single();
        const phone = profile?.phone || phone; // fallback to login phone
        if (phone) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/phone-auth-send-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
              body: JSON.stringify({ phone, otp_code: code, channel: 'sms', context: 'mfa_login' })
            });
          } catch (e) { console.error('MFA SMS delivery error:', e); }
        }
      } else if (factor.type === 'email') {
        const userEmail = await getUserEmail(adminClient, userId);
        const userName = await getUserName(adminClient, userId);
        if (userEmail) {
          await sendManagedEmail(adminClient, {
            email_key: 'mfa_login_code',
            recipient_email: userEmail,
            recipient_user_id: userId,
            variables: { code, user_name: userName, expires_minutes: '5' }
          });
        }
      }
      console.log(`MFA challenge created for user ${userId}, factor ${factor.type}, code delivered`);
    }

    // Record session
    await adminClient.from('user_sessions').insert({
      user_id: userId,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      app_context: app_context || 'web'
    });

    // Audit log
    await adminClient.from('audit_logs').insert({
      action_type: 'login_success',
      entity_type: 'user',
      entity_id: userId,
      performed_by: userId,
      details: { method, mfa_required: mfaRequired, app_context }
    });

    // Get user roles and memberships
    const { data: roles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const { data: memberships } = await adminClient
      .from('identity_memberships')
      .select('entity_type, entity_id, role, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    return new Response(JSON.stringify({
      user_id: userId,
      access_token: session?.access_token || null,
      refresh_token: session?.refresh_token || null,
      expires_in: session?.expires_in || null,
      mfa_required: mfaRequired,
      challenge_id: challengeId,
      roles: roles?.map(r => r.role) || [],
      memberships: memberships || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
    });

  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'identity-login');
  }
});
