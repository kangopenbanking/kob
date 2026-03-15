import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Generate simple math captcha
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const ops = ['+', '-', '×'] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];

    let answer: number;
    let question: string;
    switch (op) {
      case '+': answer = a + b; question = `${a} + ${b}`; break;
      case '-': answer = Math.max(a, b) - Math.min(a, b); question = `${Math.max(a, b)} - ${Math.min(a, b)}`; break;
      case '×': answer = a * b; question = `${a} × ${b}`; break;
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

    // Store hashed answer
    const { error } = await supabase.from('captcha_challenges').insert({
      session_id: sessionId,
      challenge_question: question,
      challenge_answer: answer,
      expires_at: expiresAt,
      status: 'pending',
      max_attempts: 3,
      attempts: 0,
    });

    if (error) throw error;

    return new Response(JSON.stringify({
      session_id: sessionId,
      question: `What is ${question}?`,
      expires_at: expiresAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] captcha-generate error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
