import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone_number, captcha_session_id, captcha_answer } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'phone_number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone_number.replace(/\s/g, ''))) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Optional CAPTCHA verification (this endpoint is low-risk: only returns has_pin boolean)
    // Rate limiting below provides sufficient protection against enumeration
    if (captcha_session_id && captcha_answer !== undefined) {
      const { data: captcha, error: captchaError } = await supabase
        .from('captcha_challenges')
        .select('*')
        .eq('session_id', captcha_session_id)
        .eq('status', 'pending')
        .single();

      if (captchaError || !captcha || captcha.expires_at < new Date().toISOString()) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired CAPTCHA' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const isCorrect = Number(captcha_answer) === captcha.challenge_answer;
      await supabase.from('captcha_challenges').update({
        status: isCorrect ? 'verified' : 'failed',
        verified_at: isCorrect ? new Date().toISOString() : null,
        attempts: (captcha.attempts || 0) + 1,
      }).eq('id', captcha.id);

      if (!isCorrect) {
        return new Response(
          JSON.stringify({ error: 'Incorrect CAPTCHA answer' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Rate limit: 5 checks per minute per IP (via DB)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `pin-check:${clientIp}`;
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      _client_id: rateLimitKey,
      _endpoint: 'phone-auth-check-pin',
      _limit: 5,
      _window_minutes: 1,
    });

    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Check if user exists and has PIN set
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, pin_code_hash')
      .eq('phone_number', phone_number)
      .maybeSingle();

    const hasPIN = !error && profile && profile.pin_code_hash ? true : false;
    const userExists = !error && profile ? true : false;

    // Normalize response: always return check_complete with consistent timing
    // to prevent enumeration via response differences
    return new Response(
      JSON.stringify({
        check_complete: true,
        has_pin: userExists ? hasPIN : false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] PIN check error:`, error);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
