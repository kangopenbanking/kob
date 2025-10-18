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
    console.log('Creating domestic payment:', body);

    // Validate required fields
    const { consent_id, instructed_amount, creditor_account, debtor_account, remittance_information, reference } = body;
    
    if (!consent_id) {
      throw new Error('Missing consent_id');
    }
    
    if (!instructed_amount?.amount || !instructed_amount?.currency) {
      throw new Error('Missing or invalid instructed_amount');
    }
    
    if (instructed_amount.currency !== 'XAF') {
      throw new Error('Only XAF currency is supported');
    }
    
    if (!creditor_account?.identification || !creditor_account?.name) {
      throw new Error('Missing or invalid creditor_account');
    }

    // Verify PISP consent exists and is valid
    const { data: consent, error: consentError } = await supabase
      .from('pisp_consents')
      .select('*')
      .eq('consent_id', consent_id)
      .eq('user_id', user.id)
      .eq('status', 'Authorised')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (consentError || !consent) {
      console.error('Consent error:', consentError);
      throw new Error('Valid PISP consent not found');
    }

    // Generate unique payment_id
    const payment_id = `PAY-${crypto.randomUUID()}`;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        payment_id,
        consent_id,
        user_id: user.id,
        client_id: consent.client_id,
        instructed_amount,
        creditor_account,
        debtor_account: debtor_account || consent.debtor_account,
        remittance_information,
        reference,
        status: 'Pending',
        payment_context_code: body.risk?.payment_context_code,
        merchant_category_code: body.risk?.merchant_category_code,
        merchant_customer_identification: body.risk?.merchant_customer_identification,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      throw new Error('Failed to create payment');
    }

    // Log payment creation event
    await supabase.rpc('log_consent_event', {
      _consent_id: consent_id,
      _consent_type: 'pisp',
      _event_type: 'payment_created',
      _user_id: user.id,
      _client_id: consent.client_id,
      _metadata: { payment_id }
    });

    // Return UK Open Banking v4.0 compliant response
    return new Response(
      JSON.stringify({
        Data: {
          DomesticPaymentId: payment.payment_id,
          ConsentId: payment.consent_id,
          Status: payment.status,
          CreationDateTime: payment.created_at,
          Initiation: {
            InstructedAmount: {
              Amount: instructed_amount.amount,
              Currency: instructed_amount.currency
            },
            CreditorAccount: creditor_account,
            DebtorAccount: payment.debtor_account,
            RemittanceInformation: {
              Unstructured: remittance_information
            },
            EndToEndIdentification: reference
          }
        },
        Links: {
          Self: `/pisp/v4/domestic-payments/${payment.payment_id}`
        },
        Meta: {}
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    );
  } catch (error) {
    console.error('Error in pisp-domestic-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'PISP_PAYMENT_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});