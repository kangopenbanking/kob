import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify admin caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, user_id } = await req.json();

    if (action === 'list') {
      // List all users with lockout info
      const { data: profiles, error } = await adminClient
        .from('profiles')
        .select('id, full_name, phone_number, email, pin_attempts, pin_locked_until, pin_code_hash')
        .or('pin_attempts.gt.0,pin_locked_until.not.is.null')
        .order('pin_locked_until', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching locked profiles:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch lockout data' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also get all users with PINs for the full view
      const { data: allPinUsers, error: allError } = await adminClient
        .from('profiles')
        .select('id, full_name, phone_number, email, pin_attempts, pin_locked_until, pin_code_hash')
        .not('pin_code_hash', 'is', null)
        .order('pin_locked_until', { ascending: false, nullsFirst: false });

      return new Response(JSON.stringify({
        success: true,
        locked_users: (profiles || []).map(p => ({
          ...p,
          has_pin: !!p.pin_code_hash,
          is_locked: p.pin_locked_until && new Date(p.pin_locked_until) > new Date(),
          pin_code_hash: undefined,
        })),
        all_pin_users: (allPinUsers || []).map(p => ({
          ...p,
          has_pin: !!p.pin_code_hash,
          is_locked: p.pin_locked_until && new Date(p.pin_locked_until) > new Date(),
          pin_code_hash: undefined,
        })),
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clear_lockout') {
      if (!user_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
        return new Response(JSON.stringify({ error: 'Valid user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await adminClient
        .from('profiles')
        .update({ pin_attempts: 0, pin_locked_until: null })
        .eq('id', user_id);

      if (error) {
        console.error('Error clearing lockout:', error);
        return new Response(JSON.stringify({ error: 'Failed to clear lockout' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          action_type: 'pin_lockout_cleared',
          entity_type: 'user',
          entity_id: user_id,
          performed_by: user.id,
          details: { action: 'clear_pin_lockout', admin_id: user.id },
        });
      } catch (e) { console.warn('Audit log failed:', e); }

      console.log(`Admin ${user.id} cleared PIN lockout for user ${user_id}`);
      return new Response(JSON.stringify({ success: true, message: 'Lockout cleared' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_pin') {
      if (!user_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
        return new Response(JSON.stringify({ error: 'Valid user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await adminClient
        .from('profiles')
        .update({ pin_code_hash: null, pin_attempts: 0, pin_locked_until: null })
        .eq('id', user_id);

      if (error) {
        console.error('Error resetting PIN:', error);
        return new Response(JSON.stringify({ error: 'Failed to reset PIN' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          action_type: 'pin_reset_by_admin',
          entity_type: 'user',
          entity_id: user_id,
          performed_by: user.id,
          details: { action: 'admin_pin_reset', admin_id: user.id },
        });
      } catch (e) { console.warn('Audit log failed:', e); }

      console.log(`Admin ${user.id} reset PIN for user ${user_id}`);
      return new Response(JSON.stringify({ success: true, message: 'PIN reset — user must set a new PIN on next login' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: list, clear_lockout, reset_pin' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Admin PIN lockout error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
