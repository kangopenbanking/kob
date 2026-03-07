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

    // Generate simple math challenge (single digit addition)
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    const answer = num1 + num2;
    const question = `${num1} + ${num2}`;

    // Generate unique session ID
    const sessionId = crypto.randomUUID();

    // Get client info
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Store challenge (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('captcha_challenges')
      .insert({
        session_id: sessionId,
        challenge_question: question,
        challenge_answer: answer,
        expires_at: expiresAt,
        ip_address: clientIp,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error('Failed to store captcha:', insertError);
      throw new Error('Failed to generate captcha');
    }

    console.log(`Captcha generated: ${question} = ${answer}, session: ${sessionId}`);

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        question: question,
        expires_at: expiresAt,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Captcha generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate captcha',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
