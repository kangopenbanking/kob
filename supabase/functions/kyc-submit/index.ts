import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      verification_type,
      document_type,
      document_number,
      document_country,
      document_expiry_date,
      document_front_url,
      document_back_url,
      selfie_url
    } = await req.json();

    // Insert KYC verification record
    const { data: verification, error: verificationError } = await supabase
      .from('kyc_verifications')
      .insert({
        user_id: user.id,
        verification_type,
        document_type,
        document_number,
        document_country,
        document_expiry_date,
        document_front_url,
        document_back_url,
        selfie_url,
        status: 'pending',
        verification_method: 'manual'
      })
      .select()
      .single();

    if (verificationError) {
      console.error('Error creating KYC verification:', verificationError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit KYC verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: user.id,
      _event_type: 'kyc_submission',
      _event_category: 'compliance',
      _metadata: { verification_id: verification.id, verification_type }
    });

    return new Response(
      JSON.stringify({
        success: true,
        verification_id: verification.id,
        status: verification.status,
        message: 'KYC verification submitted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in kyc-submit:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
