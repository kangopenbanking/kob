// Consolidated router for security challenges: captcha-generate, captcha-verify, sca-initiate, sca-verify
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    switch (action) {
      case 'captcha-generate': return handleCaptchaGenerate(req, supabase);
      case 'captcha-verify': return handleCaptchaVerify(supabase, params);
      case 'sca-initiate': return handleScaInitiate(req, supabase, params);
      case 'sca-verify': return handleScaVerify(req, supabase, params);
      default: return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('security-challenge error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function handleCaptchaGenerate(req: Request, supabase: any) {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  const answer = num1 + num2;
  const question = `${num1} + ${num2}`;
  const sessionId = crypto.randomUUID();
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || '';
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await supabase.from('captcha_challenges').insert({ session_id: sessionId, challenge_question: question, challenge_answer: answer, expires_at: expiresAt, ip_address: clientIp, user_agent: userAgent });
  if (error) throw new Error('Failed to generate captcha');

  return new Response(JSON.stringify({ session_id: sessionId, question, expires_at: expiresAt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCaptchaVerify(supabase: any, params: any) {
  const { session_id, answer } = params;
  if (!session_id || answer === undefined) return new Response(JSON.stringify({ error: 'session_id and answer required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: challenge, error } = await supabase.from('captcha_challenges').select('*').eq('session_id', session_id).eq('status', 'pending').single();
  if (error || !challenge) return new Response(JSON.stringify({ verified: false, error: 'Invalid or expired session' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (new Date(challenge.expires_at) < new Date()) {
    await supabase.from('captcha_challenges').update({ status: 'expired' }).eq('id', challenge.id);
    return new Response(JSON.stringify({ verified: false, error: 'Captcha expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const attempts = (challenge.attempts || 0) + 1;
  if (attempts >= (challenge.max_attempts || 3)) {
    await supabase.from('captcha_challenges').update({ status: 'failed', attempts }).eq('id', challenge.id);
    return new Response(JSON.stringify({ verified: false, error: 'Max attempts exceeded' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (parseInt(answer) === challenge.challenge_answer) {
    await supabase.from('captcha_challenges').update({ status: 'verified', verified_at: new Date().toISOString(), attempts }).eq('id', challenge.id);
    return new Response(JSON.stringify({ verified: true, session_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await supabase.from('captcha_challenges').update({ attempts }).eq('id', challenge.id);
  return new Response(JSON.stringify({ verified: false, remaining_attempts: (challenge.max_attempts || 3) - attempts }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleScaInitiate(req: Request, supabase: any, params: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { challenge_type = 'otp', context } = params;
  const challengeCode = Math.floor(100000 + Math.random() * 900000).toString();
  const challengeId = crypto.randomUUID();

  await supabase.from('sca_challenges').insert({ id: challengeId, user_id: user.id, challenge_type, challenge_code: challengeCode, context: context || {}, status: 'pending', expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() });

  return new Response(JSON.stringify({ challenge_id: challengeId, challenge_type, expires_in: 300 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleScaVerify(req: Request, supabase: any, params: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { challenge_id, code } = params;
  const { data: challenge } = await supabase.from('sca_challenges').select('*').eq('id', challenge_id).eq('user_id', user.id).eq('status', 'pending').single();

  if (!challenge || new Date(challenge.expires_at) < new Date()) return new Response(JSON.stringify({ verified: false, error: 'Invalid or expired challenge' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (code === challenge.challenge_code) {
    await supabase.from('sca_challenges').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', challenge_id);
    return new Response(JSON.stringify({ verified: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ verified: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}