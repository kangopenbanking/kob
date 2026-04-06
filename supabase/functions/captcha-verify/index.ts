import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { session_id, answer } = await req.json();

    if (!session_id || answer === undefined || answer === null) {
      return new Response(JSON.stringify({ error: 'session_id and answer required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch challenge
    const { data: challenge, error: fetchErr } = await supabase
      .from('captcha_challenges')
      .select('*')
      .eq('session_id', session_id)
      .eq('status', 'pending')
      .single();

    if (fetchErr || !challenge) {
      return new Response(JSON.stringify({ error: 'invalid_session', verified: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      await supabase.from('captcha_challenges').update({ status: 'expired' }).eq('id', challenge.id);
      return new Response(JSON.stringify({ error: 'captcha_expired', verified: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check max attempts
    if ((challenge.attempts || 0) >= (challenge.max_attempts || 3)) {
      await supabase.from('captcha_challenges').update({ status: 'failed' }).eq('id', challenge.id);
      return new Response(JSON.stringify({ error: 'max_attempts_exceeded', verified: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment attempts
    await supabase.from('captcha_challenges')
      .update({ attempts: (challenge.attempts || 0) + 1 })
      .eq('id', challenge.id);

    // Verify answer
    const numAnswer = typeof answer === 'string' ? parseInt(answer) : answer;
    if (numAnswer === challenge.challenge_answer) {
      await supabase.from('captcha_challenges')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', challenge.id);

      return new Response(JSON.stringify({ verified: true, session_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ verified: false, error: 'incorrect_answer' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] captcha-verify error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
