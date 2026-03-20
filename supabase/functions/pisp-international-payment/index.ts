import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { extractFapiHeaders, addFapiResponseHeaders, logFapiContext } from "../_shared/fapi-headers.ts";
import { rejectJweContentType, validateJwsSignature, generateResponseJws } from "../_shared/jws-signing.ts";
import { obBadRequest, obUnauthorized, obForbidden } from "../_shared/ob-errors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

/**
 * PISP International Payments (UK Open Banking v4.0.1)
 * 
 * Actions:
 *  create_consent → POST /pisp/international-payment-consents
 *  get_consent    → GET  /pisp/international-payment-consents/{id}
 *  create_payment → POST /pisp/international-payments
 *  get_payment    → GET  /pisp/international-payments/{id}
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const jweCheck = rejectJweContentType(req, corsHeaders);
  if (jweCheck) return jweCheck;

  const fapi = extractFapiHeaders(req);
  logFapiContext(fapi, 'pisp-international-payment');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));

    const body = await req.json();
    const action = body.action || 'create_payment';
    const rh = addFapiResponseHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }, fapi);

    // ── Create International Payment Consent ──
    if (action === 'create_consent') {
      const { instructed_amount, currency_of_transfer, creditor_account, creditor_agent, debtor_account, exchange_rate_information, charge_bearer } = body;
      if (!instructed_amount || !creditor_account || !currency_of_transfer) {
        return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'instructed_amount, currency_of_transfer, and creditor_account are required');
      }

      const consentId = `INTL-CONSENT-${crypto.randomUUID().slice(0, 12)}`;
      const { data: consent, error } = await supabase
        .from('pisp_consents')
        .insert({
          consent_id: consentId,
          user_id: user.id,
          client_id: body.client_id || 'self',
          payment_type: 'international',
          instructed_amount,
          creditor_account,
          debtor_account,
          currency: instructed_amount.currency || 'XAF',
          status: 'AwaitingAuthorisation',
          expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
          metadata: { currency_of_transfer, creditor_agent, exchange_rate_information, charge_bearer: charge_bearer || 'Shared' }
        })
        .select()
        .single();

      if (error) return safeErrorResponse(error, rh, 'intl-create-consent');

      const responseBody = JSON.stringify({
        Data: {
          ConsentId: consent.consent_id,
          Status: consent.status,
          CreationDateTime: consent.created_at,
          Initiation: {
            InstructedAmount: instructed_amount,
            CurrencyOfTransfer: currency_of_transfer,
            CreditorAccount: creditor_account,
            CreditorAgent: creditor_agent,
            DebtorAccount: debtor_account,
            ChargeBearer: charge_bearer || 'Shared',
            ExchangeRateInformation: exchange_rate_information,
          }
        },
        Links: { Self: `/pisp/international-payment-consents/${consent.consent_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Get Consent ──
    if (action === 'get_consent') {
      const { consent_id } = body;
      const { data: c } = await supabase.from('pisp_consents').select('*').eq('consent_id', consent_id).eq('user_id', user.id).single();
      if (!c) return obForbidden(rh, 'Consent not found');
      return new Response(JSON.stringify({
        Data: { ConsentId: c.consent_id, Status: c.status, CreationDateTime: c.created_at, Initiation: c.metadata },
        Links: { Self: `/pisp/international-payment-consents/${c.consent_id}` },
        Meta: {}
      }), { status: 200, headers: rh });
    }

    // ── Create International Payment ──
    if (action === 'create_payment') {
      const { consent_id, instructed_amount, creditor_account, currency_of_transfer } = body;
      if (!consent_id) return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'consent_id required');

      // Validate consent
      const { data: consent } = await supabase.from('pisp_consents')
        .select('*').eq('consent_id', consent_id).eq('user_id', user.id).eq('status', 'Authorised').single();
      if (!consent) return obForbidden(rh, 'Valid authorised consent not found');

      const paymentId = `INTL-PAY-${crypto.randomUUID().slice(0, 12)}`;
      const amt = instructed_amount || consent.instructed_amount;

      const { data: payment, error } = await supabase.from('payments').insert({
        payment_id: paymentId,
        consent_id,
        user_id: user.id,
        client_id: consent.client_id,
        payment_type: 'international',
        instructed_amount: amt,
        creditor_account: creditor_account || consent.creditor_account,
        debtor_account: consent.debtor_account,
        status: 'Pending',
        metadata: { currency_of_transfer, exchange_rate: consent.metadata?.exchange_rate_information }
      }).select().single();

      if (error) return safeErrorResponse(error, rh, 'intl-create-payment');

      // Mark consent as consumed
      await supabase.from('pisp_consents').update({ status: 'Consumed' }).eq('consent_id', consent_id);

      const responseBody = JSON.stringify({
        Data: {
          InternationalPaymentId: payment.payment_id,
          ConsentId: consent_id,
          Status: payment.status,
          CreationDateTime: payment.created_at,
          Initiation: {
            InstructedAmount: amt,
            CurrencyOfTransfer: currency_of_transfer || consent.metadata?.currency_of_transfer,
            CreditorAccount: payment.creditor_account,
            DebtorAccount: payment.debtor_account,
          },
          ExchangeRateInformation: consent.metadata?.exchange_rate_information,
        },
        Links: { Self: `/pisp/international-payments/${payment.payment_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Get Payment ──
    if (action === 'get_payment') {
      const { payment_id } = body;
      const { data: p } = await supabase.from('payments').select('*').eq('payment_id', payment_id).eq('user_id', user.id).single();
      if (!p) return obForbidden(rh, 'Payment not found');
      return new Response(JSON.stringify({
        Data: { InternationalPaymentId: p.payment_id, ConsentId: p.consent_id, Status: p.status, CreationDateTime: p.created_at },
        Links: { Self: `/pisp/international-payments/${p.payment_id}` },
        Meta: {}
      }), { status: 200, headers: rh });
    }

    return obBadRequest(rh, 'UK.OBIE.Field.Invalid', `Unknown action: ${action}`);
  } catch (error) {
    return safeErrorResponse(error, addFapiResponseHeaders(corsHeaders, fapi), 'pisp-international-payment');
  }
});
