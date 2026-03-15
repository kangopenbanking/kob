import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/admin-notify.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const {
      account_id,
      business_name,
      registration_number,
      business_type,
      industry,
      vat_number,
      tax_id,
      registration_date,
      business_address,
      business_description,
      annual_turnover,
      number_of_employees,
      // Document URLs
      registration_certificate_url,
      articles_of_association_url,
      tax_certificate_url,
      proof_of_address_url,
      bank_statement_url,
    } = await req.json();

    console.log('Submitting Business KYC for user:', user.id);

    // Check if business KYC already exists for this account
    const { data: existingKYC } = await supabaseAdmin
      .from('business_kyc')
      .select('id, verification_status')
      .eq('user_id', user.id)
      .eq('account_id', account_id)
      .single();

    if (existingKYC) {
      if (existingKYC.verification_status === 'approved') {
        throw new Error('Business KYC already approved for this account');
      }
      if (existingKYC.verification_status === 'pending') {
        throw new Error('Business KYC is already pending review');
      }
    }

    // Insert Business KYC using service role (bypasses RLS)
    const { data: kycData, error: kycError } = await supabaseAdmin
      .from('business_kyc')
      .insert([{
        user_id: user.id,
        account_id: account_id || null,
        business_name,
        registration_number,
        business_type,
        industry,
        vat_number: vat_number || null,
        tax_id: tax_id || null,
        registration_date: registration_date || null,
        business_address,
        business_description,
        annual_turnover: annual_turnover || null,
        number_of_employees: number_of_employees || null,
        verification_status: 'pending',
        // Document URLs
        registration_certificate_url: registration_certificate_url || null,
        articles_of_association_url: articles_of_association_url || null,
        tax_certificate_url: tax_certificate_url || null,
        proof_of_address_url: proof_of_address_url || null,
        bank_statement_url: bank_statement_url || null,
      }])
      .select()
      .single();

    if (kycError) {
      console.error('Error inserting business KYC:', kycError);
      throw kycError;
    }

    console.log('Business KYC created:', kycData.id);

    // Get institution associated with this user and update verification step
    const { data: institution } = await supabaseAdmin
      .from('institutions')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (institution) {
      await supabaseAdmin
        .from('institutions')
        .update({ 
          verification_step: 'kyb_submitted',
          kyb_submission_id: kycData.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', institution.id);

      await supabaseAdmin
        .from('institution_verification_steps')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq('institution_id', institution.id)
        .eq('step_type', 'kyb_submission');

      await supabaseAdmin
        .from('institution_verification_steps')
        .update({ status: 'in_progress' })
        .eq('institution_id', institution.id)
        .eq('step_type', 'kyb_verification');
    }

    // Link onboarding_applications to this KYB submission
    await supabaseAdmin
      .from('onboarding_applications')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        metadata: {
          kyb_id: kycData.id,
          business_name,
          business_type,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('status', ['draft', 'pending']);

    // Log audit event
    await supabaseAdmin
      .from('audit_logs')
      .insert([{
        action_type: 'business_kyc_submission',
        entity_type: 'business_kyc',
        entity_id: kycData.id,
        performed_by: user.id,
        details: {
          business_name,
          business_type,
          industry,
          institution_id: institution?.id || null,
          status: 'pending',
          has_documents: !!(registration_certificate_url || articles_of_association_url),
        }
      }]);

    // Notify all admins
    await notifyAdmins(supabaseAdmin, {
      event_type: 'kyb_submitted',
      entity_type: 'business_kyc',
      entity_id: kycData.id,
      title: 'New Business KYB Submission',
      message: `${business_name} has submitted KYB documents for review.`,
      institution_id: institution?.id,
      metadata: { business_name, business_type },
    });

    return new Response(
      JSON.stringify({
        success: true,
        kyc_id: kycData.id,
        message: 'Business KYC submitted successfully for verification'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Business KYC submission error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to submit business KYC',
        details: error.details || null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
