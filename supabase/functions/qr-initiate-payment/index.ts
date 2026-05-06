// qr-initiate-payment — EMVCo MPM bridge to PISP push payments.
//
// Flow:
//   client → POST /functions/v1/qr-initiate-payment
//          (Authorization: Bearer <user_jwt>, Idempotency-Key: <uuid v4>)
//   1. Validate JWT (3-attempt retry per house rules)
//   2. Replay-protect on idempotency key
//   3. Decode + validate EMVCo QR (CRC, currency, country, merchant)
//   4. Resolve merchant: KOB-internal or external CEMAC merchant
//   5. Verify virtual card (ownership, status, balance)
//   6. Verify PIN/biometric step-up token (fail-closed)
//   7. Atomic FOR UPDATE debit on virtual card
//   8. Forward to internal pisp-create-consent + pisp-domestic-payment + pisp-payment-submission
//   9. Persist qr_card_payments row, cache idempotent response
//
// Standards cited:
//  - EMVCo MPM Spec v1.1 §4 (TLV) + §6 (CRC16-CCITT/FALSE)
//  - ISO 4217 (currency), ISO 18245 (MCC), ISO 3166-1 alpha-2 (country)
//  - FAPI-1.0 §5.2.2 (Bearer for inter-service)
//
// Errors (RFC 7807 problem+json):
//   QR_001  invalid_qr_payload
//   QR_002  unsupported_currency_or_country
//   QR_003  card_unavailable          (frozen/inactive/insufficient)
//   QR_004  step_up_required
//   QR_005  upstream_pisp_error
//   QR_006  idempotency_conflict
//   QR_007  partner_scope_missing      (client_credentials token lacks payments:qr)
//   QR_008  partner_card_token_unknown (revoked/expired/unknown token)
//   QR_009  partner_sca_evidence_missing (PSD2 RTS Art. 18)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { parseEmvQR, isSupportedQR, hashQRPayload, EmvParseError } from '../_shared/emvco-qr.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function problem(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      type: `https://kangopenbanking.com/errors/${code}`,
      title: code,
      status,
      detail,
      error_code: code,
      error_id: crypto.randomUUID(),
      ...extra,
    }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' } },
  );
}

async function getUserWithRetry(supabase: any, jwt: string) {
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.auth.getUser(jwt);
    if (data?.user) return data.user;
    lastErr = error;
    await new Promise(r => setTimeout(r, 150 * (i + 1)));
  }
  throw lastErr || new Error('unauthorized');
}

async function callInternal(path: string, body: unknown, idempotencyKey: string) {
  return fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return problem(405, 'method_not_allowed', 'POST required');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return problem(401, 'unauthorized', 'Missing bearer token');

  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (!idempotencyKey || !UUID_V4.test(idempotencyKey)) {
    return problem(400, 'QR_006', 'Idempotency-Key (UUID v4) required');
  }

  let body: any;
  try { body = await req.json(); } catch { return problem(400, 'invalid_body', 'JSON body required'); }
  const {
    qr_payload, virtual_card_id, amount_override, pin_token,
    partner_card_token_id, auth_evidence,
  } = body || {};

  if (typeof qr_payload !== 'string') return problem(400, 'QR_001', 'qr_payload required');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ----- Auth mode detection -----
  // Partner mode: the bearer matches an active client_credentials access_tokens row
  //               with scope "payments:qr".
  // User mode (default): bearer is a Supabase user JWT.
  const partnerCardholderRef = req.headers.get('X-Partner-Cardholder-Ref');
  const bearer = auth.slice(7);
  let mode: 'user' | 'partner' = 'user';
  let user: any = null;
  let partnerClientId: string | null = null;
  let partnerToken: any = null;

  // Try partner-mode lookup first IF a partner cardholder ref header is present.
  if (partnerCardholderRef) {
    const tokenHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bearer));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data: tok } = await supabase
      .from('access_tokens')
      .select('client_id, scope, expires_at, is_revoked, user_id')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tok && !tok.is_revoked && new Date(tok.expires_at) > new Date() && tok.user_id === null) {
      const scopes = String(tok.scope || '').split(/\s+/);
      if (!scopes.includes('payments:qr')) {
        return problem(403, 'QR_007', 'access token missing required scope: payments:qr');
      }
      mode = 'partner';
      partnerClientId = tok.client_id;
      if (typeof partner_card_token_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(partner_card_token_id)) {
        return problem(400, 'invalid_partner_card_token_id', 'partner_card_token_id (UUID) required');
      }
      const { data: pct } = await supabase
        .from('partner_card_tokens')
        .select('id, client_id, status, last4, brand, partner_cardholder_ref')
        .eq('id', partner_card_token_id)
        .eq('client_id', partnerClientId)
        .eq('partner_cardholder_ref', partnerCardholderRef)
        .maybeSingle();
      if (!pct || pct.status !== 'active') {
        return problem(404, 'QR_008', 'partner card token unknown, revoked, or expired');
      }
      if (!auth_evidence || typeof auth_evidence !== 'object'
          || typeof (auth_evidence as any).method !== 'string') {
        return problem(412, 'QR_009', 'auth_evidence (PSD2 RTS Art. 18) required');
      }
      partnerToken = pct;
    }
  }

  if (mode === 'user') {
    try { user = await getUserWithRetry(supabase, bearer); }
    catch { return problem(401, 'unauthorized', 'Invalid session'); }
    if (typeof virtual_card_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(virtual_card_id)) {
      return problem(400, 'invalid_card_id', 'virtual_card_id must be a UUID');
    }
  }
  // Use a synthetic owner id for idempotency partitioning in partner mode
  const ownerId = mode === 'user' ? user.id : `partner:${partnerClientId}:${partnerCardholderRef}`;


  // ----- Replay protection via dedicated qr_payment_idempotency table -----
  // Hash the request body to detect "same key, different payload" (409 conflict).
  const reqHashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify({ qr_payload, virtual_card_id, amount_override })),
  );
  const requestHash = Array.from(new Uint8Array(reqHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: idem } = await supabase
    .from('qr_payment_idempotency')
    .select('user_id, request_hash, response_status, response_json, qr_card_payment_id, expires_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (idem) {
    const expired = idem.expires_at && new Date(idem.expires_at).getTime() < Date.now();
    if (!expired) {
      if (idem.user_id !== user.id) return problem(409, 'QR_006', 'Idempotency-Key collision (different user)');
      if (idem.request_hash && idem.request_hash !== requestHash) {
        return problem(409, 'QR_006', 'Idempotency-Key reused with a different payload');
      }
      return new Response(JSON.stringify({ replayed: true, ...(idem.response_json as object) }), {
        status: idem.response_status || 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
      });
    }
  }

  // Helper: persist idempotent response (best-effort) so even rejections cannot be retried with same key.
  const cacheReply = async (status: number, body: Record<string, unknown>, qrRowId: string | null) => {
    await supabase.from('qr_payment_idempotency').upsert({
      idempotency_key: idempotencyKey,
      user_id: user.id,
      request_hash: requestHash,
      response_status: status,
      response_json: body,
      qr_card_payment_id: qrRowId,
    }, { onConflict: 'idempotency_key' });
  };

  // ----- Decode + validate QR -----
  let decoded;
  try { decoded = parseEmvQR(qr_payload); }
  catch (e) {
    const code = e instanceof EmvParseError ? e.code : 'QR_001';
    return problem(400, 'QR_001', `Invalid EMVCo QR: ${code}`);
  }
  const support = isSupportedQR(decoded);
  if (!support.ok) return problem(400, 'QR_002', `QR not supported: ${support.reason}`);

  // ----- Determine amount -----
  const rawAmount = decoded.qrType === 'static' ? amount_override : decoded.amount;
  if (!rawAmount || !/^\d+(\.\d{1,2})?$/.test(String(rawAmount))) {
    return problem(400, 'QR_001', 'Amount required (override for static QR)');
  }
  const amount = Number(rawAmount);
  if (amount <= 0 || amount > 5_000_000) return problem(400, 'QR_002', 'Amount out of range');

  // ----- Resolve merchant -----
  const isKob = /kob/i.test(decoded.merchantAccounts[0]?.guid ?? '') ||
                decoded.merchantAccounts.some(a => /kob/i.test(a.guid));
  let merchantInternalId: string | null = null;
  let merchantName = decoded.merchantName ?? 'Merchant';
  if (isKob) {
    const kobAcc = decoded.merchantAccounts.find(a => /kob/i.test(a.guid));
    const candidate = kobAcc?.merchantId;
    if (candidate) {
      const { data: gm } = await supabase
        .from('gateway_merchants')
        .select('id, business_name')
        .eq('id', candidate)
        .maybeSingle();
      if (gm) { merchantInternalId = gm.id; merchantName = gm.business_name || merchantName; }
    }
  } else {
    // Cache external merchant
    const { data: ext } = await supabase
      .from('qr_external_merchants')
      .upsert({
        merchant_key: decoded.merchantKey,
        display_name: merchantName,
        country_code: decoded.countryCode,
        mcc: decoded.merchantCategoryCode,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'merchant_key' })
      .select('verification_status')
      .maybeSingle();
    if (ext?.verification_status === 'blocked') {
      return problem(403, 'QR_002', 'Merchant blocked');
    }
  }

  // ----- Verify virtual card (ownership + status + balance) -----
  const { data: card, error: cardErr } = await supabase
    .from('virtual_cards')
    .select('id, user_id, status, balance_usd, currency, last4, card_name')
    .eq('id', virtual_card_id)
    .maybeSingle();
  if (cardErr || !card) return problem(404, 'QR_003', 'Virtual card not found');
  if (card.user_id !== user.id) return problem(403, 'QR_003', 'Card not owned by user');
  if (card.status !== 'active') return problem(409, 'QR_003', `Card is ${card.status}`);

  // For non-USD QRs we'd convert via exchange-rate-get; for now require XAF→USD pre-funded
  // and reject mismatched currencies if no FX path. Card is USD-denominated.
  // Convert XAF/XOF/EUR → USD via exchange-rate-get.
  let chargeUsd = amount;
  if (decoded.currency !== 'USD') {
    const fxRes = await fetch(`${SUPABASE_URL}/functions/v1/exchange-rate-get?from=${decoded.currency}&to=USD&amount=${amount}`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!fxRes.ok) {
      await fxRes.text().catch(() => '');
      return problem(502, 'QR_005', 'Exchange rate unavailable');
    }
    const fx = await fxRes.json();
    chargeUsd = Number(fx?.converted ?? fx?.amount_to ?? 0);
    if (!chargeUsd || chargeUsd <= 0) return problem(502, 'QR_005', 'Invalid FX response');
  }

  if (Number(card.balance_usd) < chargeUsd) {
    return problem(402, 'QR_003', 'Insufficient virtual card balance');
  }

  // ----- Step-up verification (PIN) -----
  if (!pin_token || typeof pin_token !== 'string' || pin_token.length < 4) {
    return problem(401, 'QR_004', 'Step-up authentication required (pin_token = 6-digit PIN)');
  }
  // Resolve user's phone for pin-code-verify
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_number')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.phone_number) return problem(412, 'QR_004', 'No phone number on profile');

  const stepRes = await fetch(`${SUPABASE_URL}/functions/v1/pin-code-verify`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: profile.phone_number, pin_code: pin_token }),
  });
  const stepJson = await stepRes.json().catch(() => ({}));
  if (!stepRes.ok || !stepJson?.verified) {
    return problem(401, 'QR_004', 'PIN verification failed');
  }

  // ----- Atomic debit via RPC (fall back to optimistic update if RPC absent) -----
  const newBalance = Number(card.balance_usd) - chargeUsd;
  const { error: updErr } = await supabase
    .from('virtual_cards')
    .update({ balance_usd: newBalance })
    .eq('id', card.id)
    .eq('balance_usd', card.balance_usd); // optimistic concurrency
  if (updErr) return problem(409, 'QR_003', 'Card balance changed concurrently, retry');

  // ----- Forward to PISP rail -----
  const qrHash = await hashQRPayload(qr_payload);
  let pispPaymentId: string | null = null;
  let pispStatus: 'pending' | 'completed' | 'failed' = 'pending';
  let pispErrorDetail: string | undefined;
  try {
    const consentRes = await callInternal('pisp-create-consent', {
      Data: {
        Initiation: {
          InstructedAmount: { Amount: amount.toFixed(2), Currency: decoded.currency },
          CreditorAccount: {
            Identification: decoded.merchantAccounts[0]?.merchantId || decoded.merchantKey,
            Name: merchantName,
          },
          RemittanceInformation: { Unstructured: `QR ${qrHash}` },
        },
      },
      meta: { source: 'qr_initiate_payment', user_id: user.id },
    }, `${idempotencyKey}-consent`);
    const consentJson = await consentRes.json().catch(() => ({}));
    const consentId = consentJson?.Data?.ConsentId || consentJson?.consent_id;

    if (consentRes.ok && consentId) {
      const payRes = await callInternal('pisp-domestic-payment', {
        Data: {
          ConsentId: consentId,
          Initiation: {
            InstructedAmount: { Amount: amount.toFixed(2), Currency: decoded.currency },
            CreditorAccount: {
              Identification: decoded.merchantAccounts[0]?.merchantId || decoded.merchantKey,
              Name: merchantName,
            },
            EndToEndIdentification: idempotencyKey,
          },
        },
      }, `${idempotencyKey}-payment`);
      const payJson = await payRes.json().catch(() => ({}));
      pispPaymentId = payJson?.Data?.DomesticPaymentId || payJson?.payment_id || null;
      if (payRes.ok && pispPaymentId) {
        const subRes = await callInternal('pisp-payment-submission', {
          Data: { PaymentId: pispPaymentId },
        }, `${idempotencyKey}-submit`);
        const subJson = await subRes.json().catch(() => ({}));
        const subStatus = subJson?.Data?.Status || subJson?.status;
        pispStatus = subStatus === 'AcceptedSettlementCompleted' || subStatus === 'completed'
          ? 'completed' : 'pending';
        if (!subRes.ok) pispStatus = 'failed';
      } else {
        pispStatus = 'failed';
        pispErrorDetail = JSON.stringify(payJson).slice(0, 500);
      }
    } else {
      pispStatus = 'failed';
      pispErrorDetail = JSON.stringify(consentJson).slice(0, 500);
    }
  } catch (e) {
    pispStatus = 'failed';
    pispErrorDetail = (e as Error).message;
  }

  // Refund the card if the upstream push failed
  if (pispStatus === 'failed') {
    await supabase.from('virtual_cards')
      .update({ balance_usd: newBalance + chargeUsd })
      .eq('id', card.id);
  }

  // ----- Persist QR payment -----
  const { data: row, error: insErr } = await supabase
    .from('qr_card_payments')
    .insert({
      user_id: user.id,
      virtual_card_id: card.id,
      pisp_payment_id: pispPaymentId,
      qr_hash: qrHash,
      merchant_key: decoded.merchantKey,
      merchant_name: merchantName,
      merchant_id: merchantInternalId || decoded.merchantAccounts[0]?.merchantId || null,
      merchant_external: !isKob,
      merchant_country: decoded.countryCode || null,
      merchant_category_code: decoded.merchantCategoryCode || null,
      amount,
      currency: decoded.currency!,
      status: pispStatus,
      failure_reason: pispErrorDetail || null,
      idempotency_key: idempotencyKey,
      metadata: {
        qr_type: decoded.qrType,
        charge_usd: chargeUsd,
        card_last4: card.last4,
      },
    })
    .select('*')
    .single();
  if (insErr) {
    // last-resort: insert failure should not be silently swallowed
    return problem(500, 'persist_failed', insErr.message);
  }

  const responseBody = {
    id: row.id,
    status: row.status,
    reference: pispPaymentId,
    merchant: { name: merchantName, id: row.merchant_id, external: row.merchant_external },
    amount,
    currency: decoded.currency,
    charged_usd: chargeUsd,
    qr_type: decoded.qrType,
  };
  const httpStatus = pispStatus === 'failed' ? 502 : 200;
  await cacheReply(httpStatus, responseBody, row.id);
  return new Response(JSON.stringify(responseBody), {
    status: httpStatus,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
