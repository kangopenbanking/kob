import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone_number, new_pin_code } = await req.json();

    if (!phone_number || !new_pin_code) {
      return new Response(
        JSON.stringify({ error: 'phone_number and new_pin_code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(new_pin_code)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Rate limiting
    const rateLimitKey = `pin_reset_${phone_number}`;
    const { data: rateLimitAllowed } = await supabase.rpc('check_rate_limit', {
      _client_id: rateLimitKey,
      _endpoint: 'pin-code-reset',
      _limit: 5,
      _window_minutes: 60,
    });

    if (!rateLimitAllowed) {
      return new Response(
        JSON.stringify({ error: 'Too many PIN reset attempts. Please try again later.', retry_after: '1 hour' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' } }
      );
    }

    // The caller must have already verified their identity via Firebase OTP.
    // We verify the user exists with this phone number.
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone_number', phone_number)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Hash the new PIN using Web Crypto (salted SHA-256) — same as pin-code-set
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const pinBytes = encoder.encode(new_pin_code);
    const toHash = new Uint8Array(salt.length + pinBytes.length);
    toHash.set(salt, 0);
    toHash.set(pinBytes, salt.length);
    const digest = await crypto.subtle.digest('SHA-256', toHash);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    const pinHash = `s2$${saltHex}$${hashHex}`;

    // Update profile with new PIN
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        pin_code_hash: pinHash,
        pin_code_set_at: new Date().toISOString(),
        pin_attempts: 0,
        pin_locked_until: null,
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Failed to reset PIN:', updateError);
      throw new Error('Failed to reset PIN code');
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: profile.id,
      _event_type: 'pin_code_reset',
      _event_category: 'authentication',
      _metadata: { action: 'reset_pin_code', method: 'otp_verified' },
    });

    console.log(`PIN code reset successfully for user: ${profile.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'PIN code reset successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Reset PIN error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to reset PIN code' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
