// pos-qr-payment v2 — verifies signed QR payloads, enforces server-side idempotency,
// emits consumer + merchant notifications, and supports static (any-amount) merchant QRs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

const enc = new TextEncoder();

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const body = await req.json();
    const action = url.searchParams.get('action') || body.action;

    // ========== GENERATE (back-compat: forwards to merchant-qr issue) ==========
    if (action === 'generate') {
      const { merchant_id, amount, order_id, description } = body;
      if (!merchant_id) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id, business_name').eq('id', merchant_id).eq('user_id', user.id).maybeSingle();
      let merchantName = merchant?.business_name;
      if (!merchant) {
        const { data: staff } = await supabase.from('merchant_pos_staff')
          .select('id').eq('merchant_id', merchant_id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
        if (!staff) return new Response(JSON.stringify({ error: 'not_authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const { data: m } = await supabase.from('gateway_merchants').select('business_name').eq('id', merchant_id).maybeSingle();
        merchantName = m?.business_name || 'Merchant';
      }

      // Dynamic (one-shot, with amount/order)
      const isStatic = !amount && !order_id;
      const qr_type = isStatic ? 'static' : 'dynamic';

      // For static: reuse existing
      if (isStatic) {
        const { data: existing } = await supabase.from('merchant_qr_codes')
          .select('*').eq('merchant_id', merchant_id).eq('qr_type', 'static').eq('is_active', true).maybeSingle();
        if (existing) {
          const decoded = await buildSigned(existing, merchantName!);
          return new Response(JSON.stringify({ qr_payload: decoded.payload, decoded: decoded.decoded, url: decoded.url, qr_id: existing.id, qr_type: 'static' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // generate
      const slug = `${(merchantName || 'biz').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'biz'}-${Math.random().toString(36).slice(2, 7)}`;
      const secretBuf = new Uint8Array(32); crypto.getRandomValues(secretBuf);
      const signing_secret = Array.from(secretBuf).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: created, error: insErr } = await supabase.from('merchant_qr_codes').insert({
        merchant_id, slug, qr_type, amount: amount ? Number(amount) : null, currency: 'XAF',
        description: description || null, order_id: order_id || null, signing_secret, created_by: user.id,
      }).select('*').single();
      if (insErr) throw insErr;

      const built = await buildSigned(created, merchantName!);
      return new Response(JSON.stringify({ qr_payload: built.payload, decoded: built.decoded, url: built.url, qr_id: created.id, qr_type }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========== PAY ==========
    if (action === 'pay') {
      const idempotencyKey = req.headers.get('Idempotency-Key');
      if (!idempotencyKey) return new Response(JSON.stringify({ error: 'missing_idempotency_key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { merchant_id, amount, order_id, decoded } = body;

      // Server-side idempotency replay protection
      const { data: prior } = await supabase.from('qr_payment_idempotency')
        .select('response_json').eq('idempotency_key', idempotencyKey).maybeSingle();
      if (prior) {
        return new Response(JSON.stringify(prior.response_json), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Signed-payload verification (preferred path)
      let canonicalAmount: number | null = null;
      let qrId: string | null = null;
      let trustedMerchantId = merchant_id;

      if (decoded && decoded.slug && decoded.sig) {
        const { data: qr } = await supabase.from('merchant_qr_codes')
          .select('id, merchant_id, signing_secret, is_active, expires_at, amount, qr_type, order_id')
          .eq('slug', decoded.slug).maybeSingle();

        if (!qr) {
          await logScan(supabase, null, merchant_id, user.id, 'tampered', amount, order_id, 'unknown_slug');
          return new Response(JSON.stringify({ error: 'qr_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!qr.is_active) {
          await logScan(supabase, qr.id, qr.merchant_id, user.id, 'failed', amount, order_id, 'inactive');
          return new Response(JSON.stringify({ error: 'qr_inactive' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
          await logScan(supabase, qr.id, qr.merchant_id, user.id, 'expired', amount, order_id, 'expired');
          return new Response(JSON.stringify({ error: 'qr_expired' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { sig, url: _u, ...rest } = decoded;
        const canonical = JSON.stringify(Object.keys(rest).sort().reduce((o: any, k) => (o[k] = rest[k], o), {}));
        const expected = await hmacSign(qr.signing_secret, canonical);
        if (expected !== sig) {
          await logScan(supabase, qr.id, qr.merchant_id, user.id, 'tampered', amount, order_id, 'bad_signature');
          return new Response(JSON.stringify({ error: 'invalid_signature', message: 'QR code is forged or tampered' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Use ONLY trusted server-side values
        trustedMerchantId = qr.merchant_id;
        qrId = qr.id;
        canonicalAmount = qr.amount != null ? Number(qr.amount) : null;
      }

      // Fallback: no signed payload but we have a merchant_id — link to active static QR
      // so counters and the activity feed still reflect this payment.
      if (!qrId && trustedMerchantId) {
        const { data: staticQR } = await supabase.from('merchant_qr_codes')
          .select('id, amount').eq('merchant_id', trustedMerchantId)
          .eq('qr_type', 'static').eq('is_active', true).maybeSingle();
        if (staticQR) {
          qrId = staticQR.id;
          if (staticQR.amount != null && canonicalAmount == null) canonicalAmount = Number(staticQR.amount);
        }
      }

      if (!trustedMerchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // For dynamic QR with fixed amount, enforce server-side amount
      const total = canonicalAmount != null ? canonicalAmount : Number(amount);
      if (!total || total <= 0) return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Get consumer wallet
      const { data: consumerAccounts } = await supabase.from('accounts').select('id, institution_id').eq('user_id', user.id).limit(1);
      if (!consumerAccounts?.length) return new Response(JSON.stringify({ error: 'no_wallet' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const consumerAccountId = consumerAccounts[0].id;

      const { data: sourceBalance } = await supabase.from('account_balances')
        .select('id, amount').eq('account_id', consumerAccountId).eq('balance_type', 'ClosingAvailable').eq('credit_debit_indicator', 'Credit').maybeSingle();
      if (!sourceBalance) return new Response(JSON.stringify({ error: 'no_balance' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const available = Number(sourceBalance.amount) || 0;
      if (available < total) {
        await logScan(supabase, qrId, trustedMerchantId, user.id, 'failed', total, order_id, 'insufficient_balance');
        return new Response(JSON.stringify({ error: 'insufficient_balance', available, required: total }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Resolve merchant info for receipts
      const { data: merchantData } = await supabase.from('gateway_merchants')
        .select('institution_id, business_name, business_email, user_id').eq('id', trustedMerchantId).maybeSingle();

      // Create or attach order
      let orderId = order_id;
      let orderNumber: string | null = null;
      if (!orderId) {
        const { data: newOrder, error: oErr } = await supabase.from('pos_orders').insert({
          merchant_id: trustedMerchantId, channel: 'consumer_app', status: 'paid', currency: 'XAF',
          subtotal: total, tax_total: 0, discount_total: 0, total,
          customer_name: user.user_metadata?.full_name || user.email,
          customer_email: user.email, customer_phone: user.phone || null,
          metadata_json: { idempotency_key: idempotencyKey, qr_payment: true, qr_id: qrId, consumer_user_id: user.id },
        }).select().single();
        if (oErr) throw oErr;
        orderId = newOrder.id; orderNumber = newOrder.order_number;
      } else {
        const { data: existingOrder } = await supabase.from('pos_orders').select('order_number').eq('id', orderId).single();
        orderNumber = existingOrder?.order_number || null;
        await supabase.from('pos_orders').update({ status: 'paid' }).eq('id', orderId);
      }

      await supabase.from('pos_order_payments').insert({
        order_id: orderId, merchant_id: trustedMerchantId, status: 'succeeded', amount: total, currency: 'XAF',
        provider: 'wallet', method: 'wallet', provider_reference: `qr_wallet_${idempotencyKey}`,
      });

      // Atomic merchant credit
      const { error: creditErr } = await supabase.rpc('atomic_charge_wallet_credit', {
        _charge_id: orderId, _new_status: 'successful', _merchant_id: trustedMerchantId, _currency: 'XAF', _credit_amount: total,
      });
      if (creditErr) {
        return new Response(JSON.stringify({ error: 'wallet_credit_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Atomic consumer debit
      const { error: debitErr } = await supabase.rpc('atomic_debit_balance', {
        _account_id: consumerAccountId, _amount: total, _currency: 'XAF',
      });
      if (debitErr) {
        await supabase.rpc('atomic_dispute_wallet_adjust', {
          _merchant_id: trustedMerchantId, _currency: 'XAF', _amount: total, _direction: 'debit',
        });
        return new Response(JSON.stringify({ error: 'debit_failed', message: debitErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Status history + consumer transaction
      await supabase.from('pos_order_status_history').insert({
        order_id: orderId, status: 'paid', note: 'QR wallet payment', created_by: user.id,
      });

      const { data: consumerAccount } = await supabase.from('accounts').select('institution_id').eq('id', consumerAccountId).maybeSingle();
      const txInstitutionId = consumerAccount?.institution_id || merchantData?.institution_id;
      if (txInstitutionId) {
        await supabase.from('transactions').insert({
          user_id: user.id, account_id: consumerAccountId, institution_id: txInstitutionId,
          transaction_type: 'Payment', amount: total, currency: 'XAF', credit_debit_indicator: 'Debit',
          status: 'Booked', booking_datetime: new Date().toISOString(), value_datetime: new Date().toISOString(),
          transaction_information: `QR payment to ${merchantData?.business_name || 'Merchant'}`,
          merchant_details: { transaction_id: orderId, merchant_name: merchantData?.business_name, merchant_id: trustedMerchantId, order_number: orderNumber },
          metadata: { payment_method: 'wallet_qr', order_id: orderId, idempotency_key: idempotencyKey, qr_id: qrId },
        });
      }

      // Increment QR counters + scan log
      if (qrId) {
        await supabase.rpc('increment_qr_payment', { _qr_id: qrId, _amount: total }).catch(() => {});
        await logScan(supabase, qrId, trustedMerchantId, user.id, 'paid', total, orderId, null);
      }

      // ===== Notifications =====
      // Consumer
      try {
        await supabase.from('app_notifications').insert({
          user_id: user.id,
          type: 'transaction',
          title: 'Payment sent',
          message: `You paid ${total.toLocaleString('fr-CM')} XAF to ${merchantData?.business_name || 'Merchant'}.`,
          icon: 'arrow-up',
          metadata: { order_id: orderId, order_number: orderNumber, merchant_id: trustedMerchantId, amount: total, currency: 'XAF', method: 'qr_wallet' },
        });
      } catch (e) { console.warn('consumer notif failed:', e); }

      // Merchant owner
      if (merchantData?.user_id) {
        try {
          await supabase.from('app_notifications').insert({
            user_id: merchantData.user_id,
            type: 'transaction',
            title: 'Payment received',
            message: `${total.toLocaleString('fr-CM')} XAF received via QR from ${user.user_metadata?.full_name || user.email}.`,
            icon: 'arrow-down',
            metadata: { order_id: orderId, order_number: orderNumber, amount: total, currency: 'XAF', method: 'qr_wallet' },
          });
        } catch (e) { console.warn('merchant notif failed:', e); }
      }

      // Email receipt to consumer (best-effort)
      if (user.email) {
        try {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              to: user.email,
              template_key: 'gateway_payment_receipt',
              variables: {
                amount: total.toLocaleString('fr-CM'),
                currency: 'XAF',
                merchant_name: merchantData?.business_name || 'Merchant',
                order_number: orderNumber || orderId.slice(0, 8).toUpperCase(),
                payment_method: 'Wallet (QR)',
                date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
              },
            },
          });
        } catch (e) { console.warn('email receipt failed:', e); }
      }

      const responseJson = {
        success: true, order_id: orderId, order_number: orderNumber,
        amount: total, currency: 'XAF', payment_method: 'wallet_qr',
        merchant_name: merchantData?.business_name,
      };

      // Persist idempotency
      await supabase.from('qr_payment_idempotency').insert({
        idempotency_key: idempotencyKey, user_id: user.id, merchant_id: trustedMerchantId,
        amount: total, order_id: orderId, response_json: responseJson,
      });

      return new Response(JSON.stringify(responseJson), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-qr-payment error:', error);
    return new Response(JSON.stringify({ error: 'payment_failed', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function buildSigned(qr: any, merchantName: string) {
  const origin = Deno.env.get('PUBLIC_APP_URL') || 'https://kob.lovable.app';
  const url = `${origin}/pay/m/${qr.slug}`;
  const decoded: Record<string, any> = {
    type: 'kob_pos_pay', v: 2, slug: qr.slug, merchant_id: qr.merchant_id,
    merchant_name: merchantName, qr_id: qr.id, qr_type: qr.qr_type, currency: qr.currency,
  };
  if (qr.amount != null) decoded.amount = Number(qr.amount);
  if (qr.order_id) decoded.order_id = qr.order_id;
  if (qr.description) decoded.description = qr.description;
  if (qr.expires_at) decoded.expires_at = qr.expires_at;
  const canonical = JSON.stringify(Object.keys(decoded).sort().reduce((o: any, k) => (o[k] = decoded[k], o), {}));
  decoded.sig = await hmacSign(qr.signing_secret, canonical);
  decoded.url = url;
  return { payload: JSON.stringify(decoded), decoded, url };
}

async function logScan(supabase: any, qrId: string | null, merchantId: string, userId: string | null, outcome: string, amount: number | null, orderId: string | null, reason: string | null) {
  try {
    const { error } = await supabase.from('merchant_qr_scan_log').insert({
      qr_id: qrId, merchant_id: merchantId, scanned_by_user: userId,
      scan_outcome: outcome, amount, order_id: orderId, error_reason: reason,
    });
    if (error) console.error('logScan failed:', error.message);
  } catch (e) {
    console.error('logScan exception:', e);
  }
}
