import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { extractFapiHeaders, addFapiResponseHeaders, logFapiContext } from "../_shared/fapi-headers.ts";
import { rejectJweContentType, generateResponseJws } from "../_shared/jws-signing.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jweCheck = rejectJweContentType(req, corsHeaders);
  if (jweCheck) return jweCheck;

  const fapi = extractFapiHeaders(req);
  logFapiContext(fapi, 'pisp-domestic-payment');

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

    // Security Fix: Import validation utilities
    const { validateInput, domesticPaymentSchema, sanitizeString } = 
      await import('../_shared/validation.ts');
    
    const body = await req.json();
    console.log('[SECURE] Creating domestic payment for user:', user.id);

    // Extract and validate required fields
    const { consent_id, instructed_amount, creditor_account, debtor_account, remittance_information, reference } = body;
    
    if (!consent_id) {
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing consent_id'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Security Fix: Validate payment data structure
    const validation = validateInput(domesticPaymentSchema, {
      instructed_amount,
      creditor_account,
      remittance_information
    });
    
    if (!validation.success) {
      console.warn('[SECURITY] Payment validation failed:', validation.error);
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: validation.error
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    
    // M3 FIX: Support multi-currency (XAF, EUR, USD)
    const supportedCurrencies = ['XAF', 'EUR', 'USD'];
    if (!supportedCurrencies.includes(instructed_amount.currency)) {
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: `Currency ${instructed_amount.currency} not supported. Supported: ${supportedCurrencies.join(', ')}`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
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

    // Track payment creation event
    await supabase.from('payment_events').insert({
      payment_id: payment.id,
      event_type: 'created',
      metadata: {
        status: 'Pending',
        consent_id,
        amount: instructed_amount,
        created_by: user.id
      }
    });

    // Log consent event
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
    // Security Fix: Generic error response with secure logging
    const { logError, genericErrorResponse } = await import('../_shared/validation.ts');
    const errorId = logError('pisp-domestic-payment', error, {
      endpoint: '/pisp-domestic-payment',
      timestamp: new Date().toISOString()
    });
    
    return genericErrorResponse(corsHeaders, 500);
  }
});