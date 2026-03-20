import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { extractFapiHeaders, addFapiResponseHeaders, logFapiContext } from "../_shared/fapi-headers.ts";
import { rejectJweContentType, generateResponseJws } from "../_shared/jws-signing.ts";
import { obBadRequest, obUnauthorized, obForbidden } from "../_shared/ob-errors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

/**
 * PISP Scheduled & Standing Order Payments (UK Open Banking v4.0.1)
 * 
 * Actions:
 *  create_scheduled_consent  → POST /pisp/domestic-scheduled-payment-consents
 *  create_scheduled_payment  → POST /pisp/domestic-scheduled-payments
 *  create_standing_order_consent → POST /pisp/domestic-standing-order-consents
 *  get_consent / get_payment
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const jweCheck = rejectJweContentType(req, corsHeaders);
  if (jweCheck) return jweCheck;

  const fapi = extractFapiHeaders(req);
  logFapiContext(fapi, 'pisp-scheduled-payment');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));

    const body = await req.json();
    const action = body.action || 'create_scheduled_consent';
    const rh = addFapiResponseHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }, fapi);

    // ── Create Scheduled Payment Consent ──
    if (action === 'create_scheduled_consent') {
      const { instructed_amount, creditor_account, debtor_account, requested_execution_date } = body;
      if (!instructed_amount || !creditor_account || !requested_execution_date) {
        return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'instructed_amount, creditor_account, and requested_execution_date are required');
      }

      const consentId = `SCHED-CONSENT-${crypto.randomUUID().slice(0, 12)}`;
      const { data: consent, error } = await supabase.from('pisp_consents').insert({
        consent_id: consentId,
        user_id: user.id,
        client_id: body.client_id || 'self',
        payment_type: 'domestic_scheduled',
        instructed_amount,
        creditor_account,
        debtor_account,
        currency: instructed_amount.currency || 'XAF',
        status: 'AwaitingAuthorisation',
        expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
        metadata: { requested_execution_date }
      }).select().single();

      if (error) return safeErrorResponse(error, rh, 'sched-create-consent');

      const responseBody = JSON.stringify({
        Data: {
          ConsentId: consent.consent_id,
          Status: consent.status,
          CreationDateTime: consent.created_at,
          Permission: 'Create',
          Initiation: {
            InstructedAmount: instructed_amount,
            RequestedExecutionDateTime: requested_execution_date,
            CreditorAccount: creditor_account,
            DebtorAccount: debtor_account,
          }
        },
        Links: { Self: `/pisp/domestic-scheduled-payment-consents/${consent.consent_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Create Scheduled Payment ──
    if (action === 'create_scheduled_payment') {
      const { consent_id } = body;
      if (!consent_id) return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'consent_id required');

      const { data: consent } = await supabase.from('pisp_consents').select('*')
        .eq('consent_id', consent_id).eq('user_id', user.id).eq('status', 'Authorised').single();
      if (!consent) return obForbidden(rh, 'Valid authorised consent not found');

      const paymentId = `SCHED-PAY-${crypto.randomUUID().slice(0, 12)}`;
      const { data: payment, error } = await supabase.from('payments').insert({
        payment_id: paymentId,
        consent_id,
        user_id: user.id,
        client_id: consent.client_id,
        payment_type: 'domestic_scheduled',
        instructed_amount: consent.instructed_amount,
        creditor_account: consent.creditor_account,
        debtor_account: consent.debtor_account,
        status: 'Pending',
        metadata: { requested_execution_date: consent.metadata?.requested_execution_date }
      }).select().single();

      if (error) return safeErrorResponse(error, rh, 'sched-create-payment');

      await supabase.from('pisp_consents').update({ status: 'Consumed' }).eq('consent_id', consent_id);

      const responseBody = JSON.stringify({
        Data: {
          DomesticScheduledPaymentId: payment.payment_id,
          ConsentId: consent_id,
          Status: payment.status,
          CreationDateTime: payment.created_at,
        },
        Links: { Self: `/pisp/domestic-scheduled-payments/${payment.payment_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Create Standing Order Consent ──
    if (action === 'create_standing_order_consent') {
      const { instructed_amount, creditor_account, debtor_account, frequency, first_payment_date, recurring_payment_amount, final_payment_date } = body;
      if (!frequency || !creditor_account || !first_payment_date) {
        return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'frequency, creditor_account, and first_payment_date are required');
      }

      const consentId = `SO-CONSENT-${crypto.randomUUID().slice(0, 12)}`;
      const { data: consent, error } = await supabase.from('pisp_consents').insert({
        consent_id: consentId,
        user_id: user.id,
        client_id: body.client_id || 'self',
        payment_type: 'domestic_standing_order',
        instructed_amount: instructed_amount || recurring_payment_amount,
        creditor_account,
        debtor_account,
        currency: (instructed_amount || recurring_payment_amount)?.currency || 'XAF',
        status: 'AwaitingAuthorisation',
        expires_at: final_payment_date || new Date(Date.now() + 365 * 86400000).toISOString(),
        metadata: { frequency, first_payment_date, recurring_payment_amount, final_payment_date }
      }).select().single();

      if (error) return safeErrorResponse(error, rh, 'so-create-consent');

      const responseBody = JSON.stringify({
        Data: {
          ConsentId: consent.consent_id,
          Status: consent.status,
          CreationDateTime: consent.created_at,
          Permission: 'Create',
          Initiation: {
            Frequency: frequency,
            FirstPaymentDateTime: first_payment_date,
            FirstPaymentAmount: instructed_amount,
            RecurringPaymentAmount: recurring_payment_amount,
            FinalPaymentDateTime: final_payment_date,
            CreditorAccount: creditor_account,
            DebtorAccount: debtor_account,
          }
        },
        Links: { Self: `/pisp/domestic-standing-order-consents/${consent.consent_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Get Consent/Payment ──
    if (action === 'get_consent' || action === 'get_payment') {
      const id = body.consent_id || body.payment_id;
      const table = action === 'get_consent' ? 'pisp_consents' : 'payments';
      const field = action === 'get_consent' ? 'consent_id' : 'payment_id';
      const { data } = await supabase.from(table).select('*').eq(field, id).eq('user_id', user.id).single();
      if (!data) return obForbidden(rh, 'Resource not found');
      return new Response(JSON.stringify({ Data: data, Links: { Self: `/${field}/${id}` }, Meta: {} }), { status: 200, headers: rh });
    }

    return obBadRequest(rh, 'UK.OBIE.Field.Invalid', `Unknown action: ${action}`);
  } catch (error) {
    return safeErrorResponse(error, addFapiResponseHeaders(corsHeaders, fapi), 'pisp-scheduled-payment');
  }
});
