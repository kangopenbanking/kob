import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Idempotency-Key check ---
    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Idempotency-Key header', error_code: 'PISP_001' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing idempotency record
    const { data: existingKey } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('endpoint', '/v1/pisp/payment-submissions')
      .single();

    if (existingKey) {
      if (existingKey.status === 'completed' && existingKey.response_body) {
        // Replay cached response
        return new Response(JSON.stringify(existingKey.response_body), {
          status: existingKey.response_status || 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Idempotent-Replayed': 'true'
          }
        });
      }
      if (existingKey.status === 'processing') {
        return new Response(
          JSON.stringify({ error: 'Request is already being processed', error_code: 'PISP_002' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Lock idempotency key
    const { error: lockError } = await supabase
      .from('idempotency_keys')
      .upsert({
        idempotency_key: idempotencyKey,
        endpoint: '/v1/pisp/payment-submissions',
        method: 'POST',
        status: 'processing',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'idempotency_key,endpoint' });

    if (lockError) {
      console.error('Failed to lock idempotency key:', lockError);
    }

    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { payment_id } = body;

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_id', error_code: 'PISP_003' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_id', payment_id)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found', error_code: 'PISP_004' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment is in Pending status
    if (payment.status !== 'Pending') {
      return new Response(
        JSON.stringify({
          error: `Payment cannot be submitted. Current status: ${payment.status}`,
          error_code: 'PISP_005'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Valid consent not found for this payment', error_code: 'PISP_006' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'AcceptedSettlementInProgress',
        expected_execution_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        expected_settlement_date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', payment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Payment update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit payment', error_code: 'PISP_007' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Track payment_events ---
    await supabase.from('payment_events').insert({
      payment_id: updatedPayment.id,
      event_type: 'status_change',
      metadata: {
        from_status: 'Pending',
        to_status: 'AcceptedSettlementInProgress',
        idempotency_key: idempotencyKey,
        submitted_by: user.id
      }
    });

    // Log consent event
    await supabase.rpc('log_consent_event', {
      _consent_id: payment.consent_id,
      _consent_type: 'pisp',
      _event_type: 'payment_submitted',
      _user_id: user.id,
      _client_id: payment.client_id,
      _metadata: { payment_id }
    });

    // Record transaction fee
    try {
      const { data: account } = await supabase
        .from('accounts')
        .select('institution_id')
        .eq('account_id', payment.debtor_account?.identification)
        .single();

      if (account?.institution_id) {
        await supabase.rpc('record_transaction_fee', {
          _institution_id: account.institution_id,
          _transaction_type: 'domestic_payment',
          _transaction_ref: updatedPayment.payment_id,
          _transaction_amount: parseFloat(updatedPayment.instructed_amount?.amount || '0'),
          _transaction_id: updatedPayment.id,
          _metadata: {
            payment_id: updatedPayment.payment_id,
            consent_id: updatedPayment.consent_id
          }
        });
      }
    } catch (feeError) {
      console.error('Error recording transaction fee:', feeError);
    }

    // Build response
    const responseBody = {
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
        Self: `https://api.kangopenbanking.com/v1/pisp/domestic-payment-submissions/${updatedPayment.payment_id}`
      },
      Meta: {}
    };

    // --- Store idempotency result ---
    await supabase
      .from('idempotency_keys')
      .update({
        status: 'completed',
        response_status: 200,
        response_body: responseBody
      })
      .eq('idempotency_key', idempotencyKey)
      .eq('endpoint', '/v1/pisp/payment-submissions');

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Error in pisp-payment-submission:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        error_code: 'PISP_999'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
