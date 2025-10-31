// Phase 5: Certificate List Function
// Lists all certificates for a TPP registration

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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

    // Get query parameters
    const url = new URL(req.url);
    const tppRegistrationId = url.searchParams.get('tpp_registration_id');

    console.log('Fetching certificates', { userId: user.id, tppRegistrationId });

    // Build query - get certificates for user's TPP registrations
    let query = supabase
      .from('client_certificates')
      .select(`
        *,
        tpp_registrations(id, client_id, client_name, institution_id)
      `);

    if (tppRegistrationId) {
      query = query.eq('tpp_registration_id', tppRegistrationId);
    }

    const { data: allCerts, error: certError } = await query.order('created_at', { ascending: false });

    if (certError) {
      console.error('Failed to fetch certificates:', certError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch certificates', details: certError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by user ownership
    const userInstitutions = await supabase
      .from('institutions')
      .select('id')
      .eq('user_id', user.id);

    const userInstitutionIds = new Set(userInstitutions.data?.map(i => i.id) || []);
    const certificates = (allCerts || []).filter((cert: any) => 
      userInstitutionIds.has(cert.tpp_registrations?.institution_id)
    );


    // Format response with status indicators
    const formattedCertificates = certificates.map((cert: any) => {
      const now = new Date();
      const validUntil = new Date(cert.valid_until);
      const daysUntilExpiry = Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let status = 'active';
      if (cert.is_revoked) {
        status = 'revoked';
      } else if (validUntil < now) {
        status = 'expired';
      } else if (daysUntilExpiry < 30) {
        status = 'expiring_soon';
      }

      return {
        id: cert.id,
        fingerprint: cert.fingerprint,
        thumbprint: cert.thumbprint,
        subject_dn: cert.subject_dn,
        issuer_dn: cert.issuer_dn,
        serial_number: cert.serial_number,
        valid_from: cert.valid_from,
        valid_until: cert.valid_until,
        days_until_expiry: daysUntilExpiry,
        status,
        is_revoked: cert.is_revoked,
        revoked_at: cert.revoked_at,
        revocation_reason: cert.revocation_reason,
        usage_count: cert.usage_count || 0,
        last_used_at: cert.last_used_at,
        created_at: cert.created_at,
        tpp_registration: {
          id: cert.tpp_registrations.id,
          client_id: cert.tpp_registrations.client_id,
          client_name: cert.tpp_registrations.client_name,
        }
      };
    });

    console.log(`Returning ${formattedCertificates.length} certificates`);

    return new Response(
      JSON.stringify({ 
        certificates: formattedCertificates,
        count: formattedCertificates.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Certificate list error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
