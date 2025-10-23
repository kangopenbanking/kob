import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    const {
      operation_type,
      operation_id,
      challenge_type = 'otp_email'
    } = await req.json();

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create SCA challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('sca_challenges')
      .insert({
        user_id: user.id,
        challenge_type,
        operation_type,
        operation_id,
        challenge_code: otp,
        expires_at: expiresAt.toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      })
      .select()
      .single();

    if (challengeError) {
      console.error('Error creating SCA challenge:', challengeError);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate SCA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP based on challenge type
    if (challenge_type === 'otp_email') {
      await supabase.functions.invoke('send-communication', {
        body: {
          recipient_id: user.id,
          recipient_email: user.email,
          communication_type: 'email',
          subject: 'Security Verification Code',
          body: `Your verification code is: ${otp}. This code expires in 10 minutes.`
        }
      });
    } else if (challenge_type === 'otp_sms') {
      // SMS implementation would go here
      console.log('SMS OTP:', otp);
    }

    return new Response(
      JSON.stringify({
        success: true,
        challenge_id: challenge.id,
        expires_at: challenge.expires_at,
        message: `Verification code sent via ${challenge_type}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sca-initiate:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
