// Phase 5: Certificate Revoke Function
// Revokes a client certificate and invalidates all bound tokens

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { certificate_id, reason } = body;

    if (!certificate_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: certificate_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing certificate revocation', { certificateId: certificate_id, reason });

    // Verify certificate exists and user owns it
    const { data: cert, error: certError } = await supabase
      .from('client_certificates')
      .select(`
        id,
        thumbprint,
        is_revoked,
        tpp_registration_id,
        tpp_registrations!inner(
          id,
          institution_id
        )
      `)
      .eq('id', certificate_id)
      .single();

    if (certError || !cert) {
      console.error('Certificate not found:', certError);
      return new Response(
        JSON.stringify({ error: 'Certificate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the certificate via institution
    const tppReg = cert.tpp_registrations as any;
    const { data: institution } = await supabase
      .from('institutions')
      .select('user_id')
      .eq('id', tppReg.institution_id)
      .single();

    if (!institution || institution.user_id !== user.id) {
      console.error('User does not own this certificate');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this certificate' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already revoked
    if (cert.is_revoked) {
      return new Response(
        JSON.stringify({ error: 'Certificate is already revoked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revoke the certificate
    const { error: updateError } = await supabase
      .from('client_certificates')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revocation_reason: reason || 'User-initiated revocation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', certificate_id);

    if (updateError) {
      console.error('Failed to revoke certificate:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to revoke certificate', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revoke all access tokens bound to this certificate
    const { error: tokenRevokeError } = await supabase
      .from('access_tokens')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq('certificate_id', certificate_id)
      .eq('is_revoked', false);

    if (tokenRevokeError) {
      console.error('Failed to revoke bound tokens:', tokenRevokeError);
      // Continue anyway - certificate is revoked
    }

    console.log('Certificate revoked successfully', { certificateId: certificate_id });

    return new Response(
      JSON.stringify({
        message: 'Certificate revoked successfully',
        certificate_id: certificate_id,
        revoked_at: new Date().toISOString(),
        reason: reason || 'User-initiated revocation',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Certificate revoke error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
