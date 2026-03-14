import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/errors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case 'enable-totp': {
        // Generate TOTP secret
        const secretBytes = new Uint8Array(20);
        crypto.getRandomValues(secretBytes);
        const secret = btoa(String.fromCharCode(...secretBytes));
        const issuer = 'KangOpenBanking';
        const accountName = userData.user.email || userData.user.phone || userId;
        const otpauthUri = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

        const { data: factor, error: factorError } = await adminClient
          .from('mfa_factors')
          .insert({
            user_id: userId,
            type: 'totp',
            secret_encrypted: secret, // In production, encrypt with KMS
            friendly_name: params.friendly_name || 'Authenticator App',
            enabled: false
          })
          .select('id')
          .single();

        if (factorError) {
          return new Response(JSON.stringify({ error: 'Failed to create MFA factor' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await adminClient.from('audit_logs').insert({
          action_type: 'mfa_totp_setup_started',
          entity_type: 'user',
          entity_id: userId,
          performed_by: userId,
          details: { factor_id: factor.id }
        });

        return new Response(JSON.stringify({
          factor_id: factor.id,
          totp_uri: otpauthUri,
          secret,
          qr_data: otpauthUri
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'verify': {
        const { challenge_id, code } = params;
        if (!challenge_id || !code) {
          return new Response(JSON.stringify({ error: 'challenge_id and code required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get challenge
        const { data: challenge } = await adminClient
          .from('mfa_challenges')
          .select('*')
          .eq('id', challenge_id)
          .eq('user_id', userId)
          .is('verified_at', null)
          .single();

        if (!challenge) {
          return new Response(JSON.stringify({ error: 'Invalid or expired challenge' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (new Date(challenge.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: 'Challenge expired' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verify code hash
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(code));
        const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        if (codeHash !== challenge.challenge_code_hash) {
          return new Response(JSON.stringify({ error: 'Invalid code' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Mark verified
        await adminClient.from('mfa_challenges').update({
          verified_at: new Date().toISOString()
        }).eq('id', challenge_id);

        // If this was setup verification, enable the factor
        const { data: factor } = await adminClient
          .from('mfa_factors')
          .select('enabled')
          .eq('id', challenge.factor_id)
          .single();

        if (factor && !factor.enabled) {
          await adminClient.from('mfa_factors').update({
            enabled: true,
            verified_at: new Date().toISOString()
          }).eq('id', challenge.factor_id);
        }

        await adminClient.from('audit_logs').insert({
          action_type: 'mfa_verified',
          entity_type: 'user',
          entity_id: userId,
          performed_by: userId,
          details: { challenge_id, factor_id: challenge.factor_id }
        });

        return new Response(JSON.stringify({ verified: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'challenge': {
        // Create a new challenge for step-up auth
        const { data: factors } = await adminClient
          .from('mfa_factors')
          .select('id, type, phone_snapshot, email_snapshot')
          .eq('user_id', userId)
          .eq('enabled', true)
          .limit(1);

        if (!factors || factors.length === 0) {
          return new Response(JSON.stringify({ error: 'No MFA factor configured' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const factor = factors[0];
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
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            ip_address: req.headers.get('x-forwarded-for') || null
          })
          .select('id')
          .single();

        // TODO: Actually send the code via SMS/email
        console.log(`MFA challenge code for user ${userId}: ${code}`);

        return new Response(JSON.stringify({
          challenge_id: challenge?.id,
          factor_type: factor.type,
          expires_in: 300
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'disable': {
        const { factor_id } = params;
        if (!factor_id) {
          return new Response(JSON.stringify({ error: 'factor_id required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await adminClient.from('mfa_factors').update({ enabled: false }).eq('id', factor_id).eq('user_id', userId);

        await adminClient.from('audit_logs').insert({
          action_type: 'mfa_disabled',
          entity_type: 'user',
          entity_id: userId,
          performed_by: userId,
          details: { factor_id }
        });

        return new Response(JSON.stringify({ disabled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list': {
        const { data: factors } = await adminClient
          .from('mfa_factors')
          .select('id, type, friendly_name, enabled, verified_at, created_at')
          .eq('user_id', userId);

        return new Response(JSON.stringify({ factors: factors || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'identity-mfa');
  }
});
