import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { challenge_id, code } = await req.json();

    // Get challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('sca_challenges')
      .select('*')
      .eq('id', challenge_id)
      .eq('user_id', user.id)
      .single();

    if (challengeError || !challenge) {
      return new Response(
        JSON.stringify({ error: 'Challenge not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(challenge.expires_at) < new Date()) {
      await supabase
        .from('sca_challenges')
        .update({ status: 'expired' })
        .eq('id', challenge_id);

      return new Response(
        JSON.stringify({ error: 'Challenge expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max attempts exceeded
    if (challenge.attempts >= challenge.max_attempts) {
      await supabase
        .from('sca_challenges')
        .update({ status: 'failed' })
        .eq('id', challenge_id);

      return new Response(
        JSON.stringify({ error: 'Maximum attempts exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash submitted code and compare against stored hash
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(code));
    const inputHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (challenge.challenge_code !== inputHash) {
      await supabase
        .from('sca_challenges')
        .update({ 
          attempts: challenge.attempts + 1,
          status: challenge.attempts + 1 >= challenge.max_attempts ? 'failed' : 'pending'
        })
        .eq('id', challenge_id);

      return new Response(
        JSON.stringify({ 
          error: 'Invalid code',
          attempts_remaining: challenge.max_attempts - (challenge.attempts + 1)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - mark as verified
    await supabase
      .from('sca_challenges')
      .update({ 
        status: 'verified',
        verified_at: new Date().toISOString()
      })
      .eq('id', challenge_id);

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: user.id,
      _event_type: 'sca_verified',
      _event_category: 'authentication',
      _metadata: { 
        challenge_id,
        operation_type: challenge.operation_type,
        operation_id: challenge.operation_id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification successful'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sca-verify:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
