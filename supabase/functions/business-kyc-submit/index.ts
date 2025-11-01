import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user authentication
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
      }])
      .select()
      .single();

    if (kycError) {
      console.error('Error inserting business KYC:', kycError);
      throw kycError;
    }

    console.log('Business KYC created:', kycData.id);

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
          status: 'pending'
        }
      }]);

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
