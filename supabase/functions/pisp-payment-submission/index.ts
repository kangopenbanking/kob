import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    const body = await req.json();
    console.log('Submitting payment for execution:', body);

    const { payment_id } = body;
    
    if (!payment_id) {
      throw new Error('Missing payment_id');
    }

    // Fetch payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_id', payment_id)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      console.error('Payment fetch error:', paymentError);
      throw new Error('Payment not found');
    }

    // Verify payment is in Pending status
    if (payment.status !== 'Pending') {
      throw new Error(`Payment cannot be submitted. Current status: ${payment.status}`);
    }

    // Verify consent is still valid
    const { data: consent, error: consentError } = await supabase
      .from('pisp_consents')
      .select('*')
      .eq('consent_id', payment.consent_id)
      .eq('status', 'Authorised')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (consentError || !consent) {
      console.error('Consent validation error:', consentError);
      throw new Error('Valid consent not found for this payment');
    }

    // Update payment status to AcceptedSettlementInProgress
    // In a real implementation, this would trigger actual payment processing
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'AcceptedSettlementInProgress',
        expected_execution_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        expected_settlement_date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // 2 days
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', payment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Payment update error:', updateError);
      throw new Error('Failed to submit payment');
    }

    // Log payment submission event
    await supabase.rpc('log_consent_event', {
      _consent_id: payment.consent_id,
      _consent_type: 'pisp',
      _event_type: 'payment_submitted',
      _user_id: user.id,
      _client_id: payment.client_id,
      _metadata: { payment_id }
    });

    // Return UK Open Banking v4.0 compliant response
    return new Response(
      JSON.stringify({
        Data: {
          DomesticPaymentId: updatedPayment.payment_id,
          ConsentId: updatedPayment.consent_id,
          Status: updatedPayment.status,
          CreationDateTime: updatedPayment.created_at,
          StatusUpdateDateTime: updatedPayment.updated_at,
          ExpectedExecutionDateTime: updatedPayment.expected_execution_date,
          ExpectedSettlementDateTime: updatedPayment.expected_settlement_date,
          Initiation: {
            InstructedAmount: updatedPayment.instructed_amount,
            CreditorAccount: updatedPayment.creditor_account,
            DebtorAccount: updatedPayment.debtor_account,
            RemittanceInformation: {
              Unstructured: updatedPayment.remittance_information
            },
            EndToEndIdentification: updatedPayment.reference
          }
        },
        Links: {
          Self: `/pisp/v4/domestic-payment-submissions/${updatedPayment.payment_id}`
        },
        Meta: {}
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in pisp-payment-submission:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'PISP_PAYMENT_SUBMISSION_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});