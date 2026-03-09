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

    // Verify admin caller
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify caller is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can set PINs for users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { user_id, pin_code } = await req.json();

    if (!user_id || !pin_code) {
      return new Response(
        JSON.stringify({ error: 'user_id and pin_code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!/^\d{6}$/.test(pin_code)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Hash the PIN using Web Crypto (salted SHA-256)
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

    // Update target user's profile with PIN
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        pin_code_hash: pinHash,
        pin_code_set_at: new Date().toISOString(),
        pin_attempts: 0,
        pin_locked_until: null,
      })
      .eq('id', user_id);

    if (updateError) {
      console.error('Failed to set PIN:', updateError);
      throw new Error('Failed to set PIN code');
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: user_id,
      _event_type: 'pin_code_set_by_admin',
      _event_category: 'authentication',
      _metadata: { action: 'admin_set_pin', admin_id: caller.id },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'PIN code set successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Admin set PIN error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to set PIN code' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
