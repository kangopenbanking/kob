// Phase 5: Certificate Upload Function
// Handles X.509 client certificate uploads for mTLS authentication

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateCertificateFingerprint, extractCertificateDetails, hexToBase64Url } from '../_shared/mtls.ts';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { certificate_pem, tpp_registration_id } = body;

    if (!certificate_pem || !tpp_registration_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: certificate_pem and tpp_registration_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing certificate upload for TPP registration:', tpp_registration_id);

    // Verify user owns this TPP registration
    const { data: tppReg, error: tppError } = await supabase
      .from('tpp_registrations')
      .select('id, client_id, institution_id')
      .eq('id', tpp_registration_id)
      .single();

    if (tppError || !tppReg) {
      console.error('TPP registration not found:', tppError);
      return new Response(
        JSON.stringify({ error: 'TPP registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the institution
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('id, user_id')
      .eq('id', tppReg.institution_id)
      .single();

    if (instError || !institution || institution.user_id !== user.id) {
      console.error('User does not own this TPP registration');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this TPP registration' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate certificate
    let certDetails;
    let fingerprint;
    let thumbprint;

    try {
      // Calculate fingerprint (SHA-256 of DER bytes)
      fingerprint = await calculateCertificateFingerprint(certificate_pem);
      
      // Convert to base64url thumbprint for RFC 8705
      thumbprint = hexToBase64Url(fingerprint);

      // Extract basic details
      certDetails = extractCertificateDetails(certificate_pem);

      console.log('Certificate parsed successfully', {
        fingerprint,
        thumbprint,
        subjectDN: certDetails.subjectDN
      });
    } catch (error) {
      console.error('Certificate parsing failed:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid certificate format'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate certificates by thumbprint
    const { data: existing } = await supabase
      .from('client_certificates')
      .select('id, tpp_registration_id')
      .eq('thumbprint', thumbprint)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ 
          error: 'Certificate already registered',
          certificate_id: existing.id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert certificate
    const { data: certificate, error: insertError } = await supabase
      .from('client_certificates')
      .insert({
        tpp_registration_id: tpp_registration_id,
        client_id: tppReg.id,
        certificate_pem: certificate_pem,
        fingerprint: fingerprint,
        thumbprint: thumbprint,
        subject_dn: certDetails.subjectDN,
        issuer_dn: certDetails.issuerDN,
        serial_number: certDetails.serialNumber,
        valid_from: certDetails.validFrom.toISOString(),
        valid_until: certDetails.validUntil.toISOString(),
        usage_count: 0,
        is_revoked: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert certificate:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to upload certificate',
          details: insertError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Certificate uploaded successfully', {
      certificateId: certificate.id,
      tppClientId: tppReg.client_id
    });

    return new Response(
      JSON.stringify({
        id: certificate.id,
        fingerprint: certificate.fingerprint,
        thumbprint: certificate.thumbprint,
        subject_dn: certificate.subject_dn,
        issuer_dn: certificate.issuer_dn,
        serial_number: certificate.serial_number,
        valid_from: certificate.valid_from,
        valid_until: certificate.valid_until,
        message: 'Certificate uploaded successfully'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Certificate upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
