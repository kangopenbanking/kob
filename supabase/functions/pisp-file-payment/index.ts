import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { extractFapiHeaders, addFapiResponseHeaders, logFapiContext } from "../_shared/fapi-headers.ts";
import { rejectJweContentType, generateResponseJws } from "../_shared/jws-signing.ts";
import { obBadRequest, obUnauthorized, obForbidden } from "../_shared/ob-errors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

/**
 * PISP File Payments (UK Open Banking v4.0.1)
 * Maps KOB batch payments to UK OB file-payment format.
 * 
 * Actions:
 *  create_consent → POST /pisp/file-payment-consents
 *  get_consent    → GET  /pisp/file-payment-consents/{id}
 *  create_payment → POST /pisp/file-payments (submit file reference)
 *  get_payment    → GET  /pisp/file-payments/{id}
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const jweCheck = rejectJweContentType(req, corsHeaders);
  if (jweCheck) return jweCheck;

  const fapi = extractFapiHeaders(req);
  logFapiContext(fapi, 'pisp-file-payment');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));

    const body = await req.json();
    const action = body.action || 'create_consent';
    const rh = addFapiResponseHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }, fapi);

    // ── Create File Payment Consent ──
    if (action === 'create_consent') {
      const { file_type, file_hash, number_of_transactions, control_sum, debtor_account } = body;
      if (!file_type || !file_hash) {
        return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'file_type and file_hash are required');
      }

      const consentId = `FILE-CONSENT-${crypto.randomUUID().slice(0, 12)}`;
      const { data: consent, error } = await supabase.from('pisp_consents').insert({
        consent_id: consentId,
        user_id: user.id,
        client_id: body.client_id || 'self',
        payment_type: 'file',
        debtor_account,
        currency: 'XAF',
        status: 'AwaitingAuthorisation',
        expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
        metadata: { file_type, file_hash, number_of_transactions, control_sum }
      }).select().single();

      if (error) return safeErrorResponse(error, rh, 'file-create-consent');

      const responseBody = JSON.stringify({
        Data: {
          ConsentId: consent.consent_id,
          Status: consent.status,
          CreationDateTime: consent.created_at,
          Initiation: {
            FileType: file_type,
            FileHash: file_hash,
            NumberOfTransactions: number_of_transactions,
            ControlSum: control_sum,
            DebtorAccount: debtor_account,
          }
        },
        Links: { Self: `/pisp/file-payment-consents/${consent.consent_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Create File Payment (submit) ──
    if (action === 'create_payment') {
      const { consent_id, file_reference } = body;
      if (!consent_id) return obBadRequest(rh, 'UK.OBIE.Field.Missing', 'consent_id required');

      const { data: consent } = await supabase.from('pisp_consents').select('*')
        .eq('consent_id', consent_id).eq('user_id', user.id).eq('status', 'Authorised').single();
      if (!consent) return obForbidden(rh, 'Valid authorised consent not found');

      const paymentId = `FILE-PAY-${crypto.randomUUID().slice(0, 12)}`;

      // Link to existing batch job if file_reference matches
      let batchId = null;
      if (file_reference) {
        const { data: batch } = await supabase.from('bank_batch_jobs').select('id')
          .eq('correlation_id', file_reference).maybeSingle();
        batchId = batch?.id;
      }

      const { data: payment, error } = await supabase.from('payments').insert({
        payment_id: paymentId,
        consent_id,
        user_id: user.id,
        client_id: consent.client_id,
        payment_type: 'file',
        status: 'Pending',
        metadata: {
          file_type: consent.metadata?.file_type,
          file_hash: consent.metadata?.file_hash,
          file_reference,
          batch_id: batchId,
          number_of_transactions: consent.metadata?.number_of_transactions,
          control_sum: consent.metadata?.control_sum,
        }
      }).select().single();

      if (error) return safeErrorResponse(error, rh, 'file-create-payment');

      await supabase.from('pisp_consents').update({ status: 'Consumed' }).eq('consent_id', consent_id);

      const responseBody = JSON.stringify({
        Data: {
          FilePaymentId: payment.payment_id,
          ConsentId: consent_id,
          Status: payment.status,
          CreationDateTime: payment.created_at,
          Initiation: consent.metadata,
        },
        Links: { Self: `/pisp/file-payments/${payment.payment_id}` },
        Meta: {}
      });

      const jwsSig = await generateResponseJws(responseBody);
      return new Response(responseBody, { status: 201, headers: { ...rh, 'x-jws-signature': jwsSig } });
    }

    // ── Get Consent / Payment ──
    if (action === 'get_consent') {
      const { consent_id } = body;
      const { data: c } = await supabase.from('pisp_consents').select('*').eq('consent_id', consent_id).eq('user_id', user.id).single();
      if (!c) return obForbidden(rh, 'Consent not found');
      return new Response(JSON.stringify({
        Data: { ConsentId: c.consent_id, Status: c.status, Initiation: c.metadata },
        Links: { Self: `/pisp/file-payment-consents/${c.consent_id}` }, Meta: {}
      }), { status: 200, headers: rh });
    }

    if (action === 'get_payment') {
      const { payment_id } = body;
      const { data: p } = await supabase.from('payments').select('*').eq('payment_id', payment_id).eq('user_id', user.id).single();
      if (!p) return obForbidden(rh, 'Payment not found');
      return new Response(JSON.stringify({
        Data: { FilePaymentId: p.payment_id, ConsentId: p.consent_id, Status: p.status, Initiation: p.metadata },
        Links: { Self: `/pisp/file-payments/${p.payment_id}` }, Meta: {}
      }), { status: 200, headers: rh });
    }

    return obBadRequest(rh, 'UK.OBIE.Field.Invalid', `Unknown action: ${action}`);
  } catch (error) {
    return safeErrorResponse(error, addFapiResponseHeaders(corsHeaders, fapi), 'pisp-file-payment');
  }
});
