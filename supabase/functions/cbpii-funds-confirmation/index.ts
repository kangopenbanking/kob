import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";
import { extractFapiHeaders, addFapiResponseHeaders, logFapiContext } from "../_shared/fapi-headers.ts";
import { rejectJweContentType } from "../_shared/jws-signing.ts";
import { obBadRequest, obUnauthorized, obForbidden, obNotFound } from "../_shared/ob-errors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

/**
 * CBPII — Confirmation of Funds (UK Open Banking v4.0.1 §9)
 * 
 * Actions:
 *  POST /cbpii/funds-confirmation-consents  → create consent
 *  GET  /cbpii/funds-confirmation-consents/{id} → get consent
 *  DELETE /cbpii/funds-confirmation-consents/{id} → revoke consent
 *  POST /cbpii/funds-confirmation → check funds availability
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jweCheck = rejectJweContentType(req, corsHeaders);
  if (jweCheck) return jweCheck;

  const fapi = extractFapiHeaders(req);
  logFapiContext(fapi, 'cbpii-funds-confirmation');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return obUnauthorized(addFapiResponseHeaders(corsHeaders, fapi));

    const body = req.method === 'POST' ? await req.json() : {};
    const action = body.action || 'check_funds';
    const responseHeaders = addFapiResponseHeaders({ ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, fapi);

    // ── Create CBPII Consent ──
    if (action === 'create_consent') {
      const { debtor_account, expiration_date } = body;
      if (!debtor_account?.identification) {
        return obBadRequest(responseHeaders, 'UK.OBIE.Field.Missing', 'debtor_account.identification is required', 'Data.DebtorAccount.Identification');
      }

      const consentId = `CBPII-${crypto.randomUUID().slice(0, 12)}`;
      const { data: consent, error } = await supabase
        .from('cbpii_consents')
        .insert({
          consent_id: consentId,
          user_id: user.id,
          client_id: body.client_id || 'self',
          debtor_account,
          expiration_date: expiration_date || new Date(Date.now() + 90 * 86400000).toISOString(),
          status: 'AwaitingAuthorisation'
        })
        .select()
        .single();

      if (error) {
        console.error('CBPII consent creation error:', error);
        return safeErrorResponse(error, responseHeaders, 'cbpii-create-consent');
      }

      return new Response(JSON.stringify({
        Data: {
          ConsentId: consent.consent_id,
          Status: consent.status,
          CreationDateTime: consent.created_at,
          ExpirationDateTime: consent.expiration_date,
          DebtorAccount: consent.debtor_account,
        },
        Links: { Self: `/cbpii/funds-confirmation-consents/${consent.consent_id}` },
        Meta: {}
      }), { status: 201, headers: responseHeaders });
    }

    // ── Get CBPII Consent ──
    if (action === 'get_consent') {
      const { consent_id } = body;
      if (!consent_id) return obBadRequest(responseHeaders, 'UK.OBIE.Field.Missing', 'consent_id required');

      const { data: consent } = await supabase
        .from('cbpii_consents')
        .select('*')
        .eq('consent_id', consent_id)
        .eq('user_id', user.id)
        .single();

      if (!consent) return obNotFound(responseHeaders, 'CBPII Consent');

      return new Response(JSON.stringify({
        Data: {
          ConsentId: consent.consent_id,
          Status: consent.status,
          CreationDateTime: consent.created_at,
          ExpirationDateTime: consent.expiration_date,
          DebtorAccount: consent.debtor_account,
        },
        Links: { Self: `/cbpii/funds-confirmation-consents/${consent.consent_id}` },
        Meta: {}
      }), { status: 200, headers: responseHeaders });
    }

    // ── Revoke CBPII Consent ──
    if (action === 'revoke_consent') {
      const { consent_id } = body;
      if (!consent_id) return obBadRequest(responseHeaders, 'UK.OBIE.Field.Missing', 'consent_id required');

      const { error } = await supabase
        .from('cbpii_consents')
        .update({ status: 'Revoked', revoked_at: new Date().toISOString() })
        .eq('consent_id', consent_id)
        .eq('user_id', user.id);

      if (error) return safeErrorResponse(error, responseHeaders, 'cbpii-revoke');

      return new Response(null, { status: 204, headers: responseHeaders });
    }

    // ── Check Funds (default) ──
    const { consent_id, amount, currency } = body;
    if (!consent_id || !amount) {
      return obBadRequest(responseHeaders, 'UK.OBIE.Field.Missing', 'consent_id and amount are required');
    }

    // Validate consent
    const { data: consent } = await supabase
      .from('cbpii_consents')
      .select('*')
      .eq('consent_id', consent_id)
      .eq('user_id', user.id)
      .in('status', ['Authorised', 'AwaitingAuthorisation'])
      .single();

    if (!consent) return obForbidden(responseHeaders, 'CBPII consent not found or not authorized');

    // Check balance
    const debtorId = consent.debtor_account?.identification;
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('identification_value', debtorId)
      .eq('user_id', user.id)
      .maybeSingle();

    let fundsAvailable = false;
    if (account) {
      const { data: balance } = await supabase
        .from('account_balances')
        .select('amount')
        .eq('account_id', account.id)
        .eq('balance_type', 'ClosingAvailable')
        .order('balance_datetime', { ascending: false })
        .limit(1)
        .maybeSingle();

      fundsAvailable = (balance?.amount || 0) >= parseFloat(amount);
    }

    const confirmationId = `CBPII-CHK-${crypto.randomUUID().slice(0, 8)}`;

    return new Response(JSON.stringify({
      Data: {
        FundsConfirmationId: confirmationId,
        ConsentId: consent_id,
        CreationDateTime: new Date().toISOString(),
        FundsAvailable: fundsAvailable,
        Reference: body.reference || '',
        InstructedAmount: {
          Amount: String(amount),
          Currency: currency || 'XAF'
        }
      },
      Links: { Self: `/cbpii/funds-confirmation` },
      Meta: {}
    }), { status: 201, headers: responseHeaders });

  } catch (error) {
    return safeErrorResponse(error, addFapiResponseHeaders(corsHeaders, fapi), 'cbpii-funds-confirmation');
  }
});
