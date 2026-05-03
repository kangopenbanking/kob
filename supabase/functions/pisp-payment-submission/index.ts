import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://esm.sh/zod@3.23.8';

import { corsHeaders } from "../_shared/cors.ts";

// ---------------------------------------------------------------------------
// OBIE Read/Write 4.0 §5.4 — Domestic Payment Submission body schema.
// Mirrors public/openapi.json #/paths/~1v1~1pisp~1payment-submission/post.
// ---------------------------------------------------------------------------
const AMOUNT_PATTERN = /^[0-9]{1,15}$/;
const MCC_PATTERN = /^[0-9]{4}$/;
const CURRENCIES = ['XAF', 'XOF', 'EUR', 'USD'] as const;
const ACCOUNT_SCHEMES = ['IBAN', 'RIB', 'ACCOUNT_NUMBER'] as const;
const PAYMENT_CONTEXT_CODES = [
  'BillPayment',
  'EcommerceGoods',
  'EcommerceServices',
  'Other',
] as const;

const AccountSchema = z.object({
  scheme: z.enum(ACCOUNT_SCHEMES),
  identification: z.string().trim().min(1).max(64),
  name: z.string().trim().max(140).optional(),
});

const SubmissionBodySchema = z.object({
  payment_id: z.string().trim().min(1).max(128),
  instructed_amount: z.object({
    amount: z.string().regex(AMOUNT_PATTERN, 'amount must be a positive integer string in minor units'),
    currency: z.enum(CURRENCIES),
  }),
  creditor_account: AccountSchema,
  debtor_account: AccountSchema.optional(),
  remittance_information: z
    .object({
      unstructured: z.string().max(140).optional(),
      reference: z.string().max(35).optional(),
    })
    .optional(),
  risk: z.object({
    payment_context_code: z.enum(PAYMENT_CONTEXT_CODES),
    merchant_category_code: z.string().regex(MCC_PATTERN, 'MCC must be 4 digits').optional(),
    merchant_customer_identification: z.string().max(70).optional(),
  }),
});

type SubmissionBody = z.infer<typeof SubmissionBodySchema>;

function problem(
  status: number,
  title: string,
  errorCode: string,
  detail: string,
  errors?: Array<{ field: string; message: string; code?: string }>
) {
  return new Response(
    JSON.stringify({
      type: `https://api.kangopenbanking.com/v1/errors/${errorCode.toLowerCase()}`,
      title,
      status,
      detail,
      error_code: errorCode,
      error_id: `err_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      timestamp: new Date().toISOString(),
      ...(errors ? { errors } : {}),
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
    }
  );
}

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

    // --- Validate request body against OBIE 4.0 §5.4 schema ---
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return problem(400, 'Malformed JSON body', 'PISP_VAL_001', 'Request body is not valid JSON.');
    }
    const parsed = SubmissionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
        code: i.code,
      }));
      return problem(
        400,
        'Validation Error',
        'PISP_VAL_002',
        'Request body failed schema validation against OBIE Read/Write 4.0 §5.4.',
        errors
      );
    }
    const body: SubmissionBody = parsed.data;
    const { payment_id } = body;

    // Fetch payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_id', payment_id)
      .eq('user_id', user.id)
      .single();

    if (paymentError || !payment) {
      return problem(404, 'Payment Not Found', 'PISP_004', `Payment ${payment_id} not found for current user.`);
    }

    // Verify payment is in Pending status
    if (payment.status !== 'Pending') {
      return problem(
        400,
        'Invalid Payment Status',
        'PISP_005',
        `Payment cannot be submitted. Current status: ${payment.status}`
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
      return problem(403, 'Consent Invalid', 'PISP_006', 'Valid consent not found for this payment.');
    }

    // --- OBIE 4.0 §5.4: submission MUST mirror the consent ---
    const mismatches: Array<{ field: string; message: string; code: string }> = [];
    const consentAmount = String(
      (consent as any).amount ?? payment.instructed_amount?.amount ?? ''
    );
    const consentCurrency = String(
      (consent as any).currency ?? payment.instructed_amount?.currency ?? ''
    );
    if (consentAmount && body.instructed_amount.amount !== consentAmount) {
      mismatches.push({
        field: 'instructed_amount.amount',
        message: `must mirror consent amount (${consentAmount})`,
        code: 'CONSENT_MISMATCH',
      });
    }
    if (consentCurrency && body.instructed_amount.currency !== consentCurrency) {
      mismatches.push({
        field: 'instructed_amount.currency',
        message: `must mirror consent currency (${consentCurrency})`,
        code: 'CONSENT_MISMATCH',
      });
    }
    const consentCreditorId =
      (consent as any).creditor_account?.identification ??
      payment.creditor_account?.identification ??
      '';
    if (consentCreditorId && body.creditor_account.identification !== consentCreditorId) {
      mismatches.push({
        field: 'creditor_account.identification',
        message: 'must mirror creditor_account.identification from the consent',
        code: 'CONSENT_MISMATCH',
      });
    }
    if (mismatches.length) {
      return problem(
        422,
        'Submission Does Not Mirror Consent',
        'PISP_VAL_003',
        'OBIE Read/Write 4.0 §5.4 requires the submission body to mirror the authorised consent.',
        mismatches
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
        submitted_by: user.id,
        risk: body.risk,
        instructed_amount: body.instructed_amount,
        creditor_account: body.creditor_account,
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
        Self: `${Deno.env.get("SUPABASE_URL")!}/functions/v1/pisp/domestic-payment-submissions/${updatedPayment.payment_id}`
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
