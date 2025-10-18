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

    // Extract payment_id from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const payment_id = pathParts[pathParts.length - 1];

    console.log('Fetching payment details for:', payment_id);

    if (!payment_id) {
      throw new Error('Missing payment_id');
    }

    // Fetch payment details
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

    // Return UK Open Banking v4.0 compliant response
    return new Response(
      JSON.stringify({
        Data: {
          DomesticPaymentId: payment.payment_id,
          ConsentId: payment.consent_id,
          Status: payment.status,
          CreationDateTime: payment.created_at,
          StatusUpdateDateTime: payment.updated_at,
          ExpectedExecutionDateTime: payment.expected_execution_date,
          ExpectedSettlementDateTime: payment.expected_settlement_date,
          Initiation: {
            InstructedAmount: payment.instructed_amount,
            CreditorAccount: payment.creditor_account,
            DebtorAccount: payment.debtor_account,
            RemittanceInformation: {
              Unstructured: payment.remittance_information
            },
            EndToEndIdentification: payment.reference
          }
        },
        Links: {
          Self: `/pisp/v4/domestic-payments/${payment.payment_id}`
        },
        Meta: {}
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in pisp-payment-details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'PISP_PAYMENT_DETAILS_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});