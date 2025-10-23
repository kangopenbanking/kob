import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_id, answer } = await req.json();

    if (!session_id || answer === undefined) {
      return new Response(
        JSON.stringify({ error: 'session_id and answer are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get challenge
    const { data: challenge, error: fetchError } = await supabase
      .from('captcha_challenges')
      .select('*')
      .eq('session_id', session_id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !challenge) {
      console.error('Challenge not found:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired captcha session',
          verified: false 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check expiration
    if (new Date(challenge.expires_at) < new Date()) {
      await supabase
        .from('captcha_challenges')
        .update({ status: 'expired' })
        .eq('session_id', session_id);

      return new Response(
        JSON.stringify({ 
          error: 'Captcha has expired',
          verified: false 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check attempts
    if (challenge.attempts >= challenge.max_attempts) {
      await supabase
        .from('captcha_challenges')
        .update({ status: 'failed' })
        .eq('session_id', session_id);

      return new Response(
        JSON.stringify({ 
          error: 'Maximum attempts exceeded',
          verified: false 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Verify answer
    const isCorrect = parseInt(answer) === challenge.challenge_answer;

    if (isCorrect) {
      // Mark as verified
      await supabase
        .from('captcha_challenges')
        .update({ 
          status: 'verified',
          verified_at: new Date().toISOString() 
        })
        .eq('session_id', session_id);

      console.log(`Captcha verified successfully: ${session_id}`);

      return new Response(
        JSON.stringify({ 
          verified: true,
          message: 'Captcha verified successfully' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      // Increment attempts
      await supabase
        .from('captcha_challenges')
        .update({ attempts: challenge.attempts + 1 })
        .eq('session_id', session_id);

      const remainingAttempts = challenge.max_attempts - challenge.attempts - 1;

      console.log(`Captcha verification failed: ${session_id}, attempts: ${challenge.attempts + 1}`);

      return new Response(
        JSON.stringify({ 
          verified: false,
          error: 'Incorrect answer',
          remaining_attempts: remainingAttempts 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

  } catch (error) {
    console.error('Captcha verification error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to verify captcha',
        details: error instanceof Error ? error.message : String(error),
        verified: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
