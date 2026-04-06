import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
// bcrypt removed due to edge environment limitations

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone_number, pin_code } = await req.json();

    if (!phone_number || !pin_code) {
      return new Response(
        JSON.stringify({ error: 'phone_number and pin_code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin_code)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, pin_code_hash, pin_attempts, pin_locked_until')
      .eq('phone_number', phone_number)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'No account found with this phone number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!profile.pin_code_hash) {
      return new Response(
        JSON.stringify({ error: 'No PIN code set for this account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if account is locked
    if (profile.pin_locked_until && new Date(profile.pin_locked_until) > new Date()) {
      const minutesRemaining = Math.ceil(
        (new Date(profile.pin_locked_until).getTime() - Date.now()) / (60 * 1000)
      );
      return new Response(
        JSON.stringify({ 
          error: `Account is locked. Try again in ${minutesRemaining} minutes.`,
          locked_until: profile.pin_locked_until 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Verify PIN (support salted SHA-256 format: s2$<saltHex>$<hashHex>)
    let pinValid = false;
    const stored = profile.pin_code_hash as string;
    if (stored.startsWith('s2$')) {
      const parts = stored.split('$');
      const saltHex = parts[1];
      const storedHashHex = parts[2];
      const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      const encoder = new TextEncoder();
      const pinBytes = encoder.encode(pin_code);
      const toHash = new Uint8Array(salt.length + pinBytes.length);
      toHash.set(salt, 0);
      toHash.set(pinBytes, salt.length);
      const digest = await crypto.subtle.digest('SHA-256', toHash);
      const computedHashHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      pinValid = computedHashHex === storedHashHex;
    } else {
      console.warn('Unsupported PIN hash format for user:', profile.id);
      pinValid = false;
    }

    if (pinValid) {
      // Reset attempts
      await supabase
        .from('profiles')
        .update({
          pin_attempts: 0,
          pin_locked_until: null,
        })
        .eq('id', profile.id);

      // Log success
      await supabase.rpc('log_security_event', {
        _user_id: profile.id,
        _event_type: 'pin_verified',
        _event_category: 'authentication',
        _metadata: { action: 'verify_pin_code' },
      });

      console.log(`PIN verified successfully for user: ${profile.id}`);

      return new Response(
        JSON.stringify({
          verified: true,
          message: 'PIN verified successfully',
          user_id: profile.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } else {
      // Increment attempts
      const newAttempts = (profile.pin_attempts || 0) + 1;
      const updateData: any = { pin_attempts: newAttempts };

      // Lock account after 3 failed attempts
      if (newAttempts >= 3) {
        updateData.pin_locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }

      await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      // Log failure
      await supabase.rpc('log_security_event', {
        _user_id: profile.id,
        _event_type: 'pin_verification_failed',
        _event_category: 'authentication',
        _metadata: { 
          action: 'verify_pin_code',
          attempts: newAttempts 
        },
      });

      console.log(`PIN verification failed for user: ${profile.id}, attempts: ${newAttempts}`);

      const remainingAttempts = 3 - newAttempts;

      return new Response(
        JSON.stringify({ 
          verified: false,
          error: 'Invalid PIN code',
          remaining_attempts: Math.max(0, remainingAttempts),
          locked: newAttempts >= 3,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

  } catch (error) {
    console.error('PIN verification error:', error);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
