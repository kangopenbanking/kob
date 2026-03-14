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
    const body = req.method === 'GET' ? { action: 'me' } : await req.json();
    const { action } = body;

    switch (action) {
      case 'me': {
        // Get profile
        const { data: profile } = await adminClient
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        // Get roles
        const { data: roles } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        // Get memberships
        const { data: memberships } = await adminClient
          .from('identity_memberships')
          .select('entity_type, entity_id, role, status')
          .eq('user_id', userId)
          .eq('status', 'active');

        // Get MFA status
        const { data: mfaFactors } = await adminClient
          .from('mfa_factors')
          .select('id, type, enabled, friendly_name')
          .eq('user_id', userId);

        // Get onboarding status
        const { data: onboarding } = await adminClient
          .from('onboarding_applications')
          .select('id, entity_type, entity_id, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        return new Response(JSON.stringify({
          user: {
            id: userId,
            email: userData.user.email,
            phone: userData.user.phone,
            ...profile
          },
          roles: roles?.map(r => r.role) || [],
          memberships: memberships || [],
          mfa: {
            enabled: mfaFactors?.some(f => f.enabled) || false,
            factors: mfaFactors || []
          },
          onboarding: onboarding || []
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'refresh': {
        const { refresh_token } = body;
        if (!refresh_token) {
          return new Response(JSON.stringify({ error: 'refresh_token required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const refreshClient = createClient(supabaseUrl, anonKey);
        const { data, error } = await refreshClient.auth.refreshSession({ refresh_token });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
        });
      }

      case 'logout': {
        // Revoke user sessions
        await adminClient.from('user_sessions').update({
          revoked_at: new Date().toISOString()
        }).eq('user_id', userId).is('revoked_at', null);

        // Sign out via auth
        await adminClient.auth.admin.signOut(token, 'local');

        await adminClient.from('audit_logs').insert({
          action_type: 'logout',
          entity_type: 'user',
          entity_id: userId,
          performed_by: userId
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'sessions': {
        const { data: sessions } = await adminClient
          .from('user_sessions')
          .select('id, device_fingerprint, ip_address, user_agent, app_context, last_seen_at, created_at')
          .eq('user_id', userId)
          .is('revoked_at', null)
          .order('last_seen_at', { ascending: false });

        return new Response(JSON.stringify({ sessions: sessions || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'revoke-session': {
        const { session_id } = body;
        if (!session_id) {
          return new Response(JSON.stringify({ error: 'session_id required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await adminClient.from('user_sessions').update({
          revoked_at: new Date().toISOString()
        }).eq('id', session_id).eq('user_id', userId);

        return new Response(JSON.stringify({ revoked: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'identity-session');
  }
});
