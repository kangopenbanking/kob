import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

interface ExpiringCertificate {
  id: string;
  tpp_registration_id: string;
  subject_dn: string;
  valid_until: string;
  thumbprint: string;
  days_until_expiry: number;
  institution_name: string;
  contact_email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting certificate expiry monitoring...');

    // Query for certificates expiring in 30, 15, or 7 days
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fifteenDays = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get expiring certificates with TPP and institution details
    const { data: certificates, error: certError } = await supabase
      .from('client_certificates')
      .select(`
        id,
        tpp_registration_id,
        subject_dn,
        valid_until,
        thumbprint,
        tpp_registrations!inner(
          id,
          institution_id,
          institutions!inner(
            institution_name,
            contact_email
          )
        )
      `)
      .eq('is_revoked', false)
      .lte('valid_until', thirtyDays.toISOString())
      .gte('valid_until', now.toISOString());

    if (certError) {
      console.error('Error fetching certificates:', certError);
      throw certError;
    }

    console.log(`Found ${certificates?.length || 0} expiring certificates`);

    const notifications: { severity: string; count: number }[] = [];

    // Process each certificate
    for (const cert of certificates || []) {
      const validUntil = new Date(cert.valid_until);
      const daysUntilExpiry = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let severity = 'low';
      let urgency = 'informational';
      
      if (daysUntilExpiry <= 7) {
        severity = 'critical';
        urgency = 'urgent';
      } else if (daysUntilExpiry <= 15) {
        severity = 'high';
        urgency = 'important';
      } else if (daysUntilExpiry <= 30) {
        severity = 'medium';
        urgency = 'notice';
      }

      const institution = (cert.tpp_registrations as any).institutions;
      const contactEmail = institution.contact_email;
      const institutionName = institution.institution_name;

      // Send notification via send-communication function
      const { error: commError } = await supabase.functions.invoke('send-communication', {
        body: {
          channel: 'email',
          recipient: contactEmail,
          template_code: 'CERTIFICATE_EXPIRY',
          variables: {
            institution_name: institutionName,
            certificate_subject: cert.subject_dn,
            expiry_date: validUntil.toISOString().split('T')[0],
            days_until_expiry: daysUntilExpiry,
            thumbprint: cert.thumbprint,
            urgency: urgency,
            severity: severity
          },
          priority: severity === 'critical' ? 'high' : 'normal'
        }
      });

      if (commError) {
        console.error(`Failed to send notification for certificate ${cert.id}:`, commError);
      } else {
        console.log(`Sent ${severity} notification for certificate ${cert.id} (${daysUntilExpiry} days until expiry)`);
        notifications.push({ severity, count: 1 });
      }
    }

    // Aggregate notification counts
    const summary = notifications.reduce((acc, { severity, count }) => {
      acc[severity] = (acc[severity] || 0) + count;
      return acc;
    }, {} as Record<string, number>);

    console.log('Certificate expiry monitoring completed', summary);

    return new Response(
      JSON.stringify({
        success: true,
        processed: certificates?.length || 0,
        notifications_sent: notifications.length,
        summary
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Certificate expiry monitor error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process certificate expiry monitoring'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
