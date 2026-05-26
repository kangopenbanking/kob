import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/errors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ─── create_intent ────────────────────────────────────────
    if (action === 'create_intent') {
      const {
        merchant_id,
        amount,
        currency,
        redirect_uri,
        state,
        description,
        creditor_account,
        creditor_name,
        customer_email,
        source_bank,
        target_type: rawTargetType,
        target_account_id,
      } = body;

      const target_type: 'merchant' | 'consumer_wallet' =
        rawTargetType === 'consumer_wallet' ? 'consumer_wallet' : 'merchant';

      if (!amount || !redirect_uri || !state) {
        return new Response(JSON.stringify({ error: 'Missing required fields: amount, redirect_uri, state' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let merchant: { id: string; business_name: string | null; logo_url: string | null } | null = null;
      let resolvedTargetAccountId: string | null = null;
      let resolvedCustomerUserId: string | null = null;
      let resolvedMerchantName: string | null = null;
      let resolvedLogo: string | null = null;

      if (target_type === 'merchant') {
        if (!merchant_id) {
          return new Response(JSON.stringify({ error: 'merchant_id required when target_type=merchant' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const { data: m, error: merchantErr } = await supabase
          .from('gateway_merchants')
          .select('id, business_name, logo_url')
          .eq('id', merchant_id)
          .single();
        if (merchantErr || !m) {
          return new Response(JSON.stringify({ error: 'Merchant not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        merchant = m;
        resolvedMerchantName = m.business_name;
        resolvedLogo = m.logo_url;
      } else {
        // consumer_wallet — require authenticated user, resolve their wallet
        const authHeader = req.headers.get('Authorization') || '';
        const jwt = authHeader.replace('Bearer ', '');
        if (!jwt) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const { data: authData, error: authErr } = await userClient.auth.getUser();
        if (authErr || !authData?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        resolvedCustomerUserId = authData.user.id;

        let accountId: string | null = target_account_id ?? null;
        if (!accountId) {
          const { data: walletAcc } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', resolvedCustomerUserId)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          accountId = walletAcc?.id ?? null;
        }
        if (!accountId) {
          return new Response(JSON.stringify({
            error: 'no_wallet_account',
            message: 'No active wallet found for this user.',
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        resolvedTargetAccountId = accountId;
        resolvedMerchantName = 'KANG Wallet Top-up';
      }

      // Create PISP consent. Consumer wallet top-ups are initiated by the
      // platform PISP client, not by the end-user UUID, because pisp_consents
      // enforces client_id against registered TPP clients.
      const platformPispClientId = 'kang_consumer_wallet_pisp';
      const consentId = `PBB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: consentErr } = await supabase.from('pisp_consents').insert({
        consent_id: consentId,
        client_id: platformPispClientId,
        user_id: resolvedCustomerUserId,
        payment_type: 'domestic',
        status: 'AwaitingAuthorisation',
        creditor: {
          name: creditor_name || resolvedMerchantName,
          ...(creditor_account ? { identification: creditor_account } : {}),
        },
        instructed_amount: { amount: String(amount), currency: currency || 'XAF' },
        expires_at: expiresAt,
        risk: { payment_context: target_type === 'consumer_wallet' ? 'wallet_topup' : 'pay_by_bank' },
      });

      if (consentErr) {
        console.error('Consent creation failed:', consentErr);
        return safeErrorResponse(consentErr, corsHeaders, 'create_consent');
      }

      // Create pay_by_bank_intent
      const { data: intent, error: intentErr } = await supabase
        .from('pay_by_bank_intents')
        .insert({
          merchant_id: merchant?.id ?? null,
          target_type,
          target_account_id: resolvedTargetAccountId,
          customer_user_id: resolvedCustomerUserId,
          consent_id: consentId,
          amount,
          currency: currency || 'XAF',
          redirect_uri,
          state,
          status: 'awaiting_auth',
          merchant_name: resolvedMerchantName,
          merchant_logo_url: resolvedLogo,
          creditor_account,
          creditor_name: creditor_name || resolvedMerchantName,
          description,
          expires_at: expiresAt,
          customer_email,
          metadata: source_bank ? { source_bank } : {},
        })
        .select('id')
        .single();

      if (intentErr || !intent) {
        return safeErrorResponse(intentErr, corsHeaders, 'create_intent');
      }

      const finalAuthUrl = `${req.headers.get('origin') || 'https://kangopenbanking.com'}/pay/authorize?intent_id=${intent.id}&state=${encodeURIComponent(state)}`;
      await supabase.from('pay_by_bank_intents').update({ authorization_url: finalAuthUrl }).eq('id', intent.id);

      return new Response(JSON.stringify({
        intent_id: intent.id,
        consent_id: consentId,
        authorization_url: finalAuthUrl,
        expires_at: expiresAt,
        status: 'awaiting_auth',
        target_type,
      }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── get_intent ───────────────────────────────────────────
    if (action === 'get_intent') {
      const { intent_id } = body;
      if (!intent_id) {
        return new Response(JSON.stringify({ error: 'intent_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: intent, error } = await supabase
        .from('pay_by_bank_intents')
        .select('*')
        .eq('id', intent_id)
        .single();

      if (error || !intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Auto-expire
      if (intent.status === 'awaiting_auth' && new Date(intent.expires_at) < new Date()) {
        await supabase.from('pay_by_bank_intents').update({ status: 'expired' }).eq('id', intent_id);
        intent.status = 'expired';
      }

      return new Response(JSON.stringify(intent), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── authorize ────────────────────────────────────────────
    if (action === 'authorize') {
      // Require authenticated user for state-changing payment authorization
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.replace('Bearer ', '');
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const authedUserId = authData.user.id;

      const { intent_id, debtor_account } = body;
      const user_id = authedUserId; // Always use authenticated user, never trust body
      if (!intent_id) {
        return new Response(JSON.stringify({ error: 'intent_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get intent
      const { data: intent, error: getErr } = await supabase
        .from('pay_by_bank_intents')
        .select('*')
        .eq('id', intent_id)
        .single();

      if (getErr || !intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (intent.status !== 'awaiting_auth') {
        return new Response(JSON.stringify({ error: `Cannot authorize intent in ${intent.status} status` }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (new Date(intent.expires_at) < new Date()) {
        await supabase.from('pay_by_bank_intents').update({ status: 'expired' }).eq('id', intent_id);
        return new Response(JSON.stringify({ error: 'Intent expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const targetType = intent.target_type === 'consumer_wallet' ? 'consumer_wallet' : 'merchant';
      const amountNum = Number(intent.amount);
      const currency = intent.currency || 'XAF';

      // ─── Branch: CONSUMER WALLET TOP-UP (PISP funding from external bank) ───
      if (targetType === 'consumer_wallet') {
        const walletId = intent.target_account_id;
        if (!walletId) {
          return new Response(JSON.stringify({ error: 'no_target_account' }), {
            status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await supabase.from('pisp_consents')
          .update({ status: 'Authorised', user_id })
          .eq('consent_id', intent.consent_id);
        await supabase.from('payments').insert({
          payment_id: paymentId,
          consent_id: intent.consent_id,
          status: 'AcceptedSettlementInProcess',
          payment_type: 'wallet_topup',
          instructed_amount: JSON.stringify({ amount: String(amountNum), currency }),
          creditor_account: JSON.stringify({ identification: walletId, scheme: 'KANG_WALLET' }),
          debtor_account: JSON.stringify({ identification: debtor_account || 'external_bank', scheme: 'BANK' }),
        });

        await supabase.from('pay_by_bank_intents').update({
          status: 'authorized',
          customer_user_id: user_id,
          debtor_account: debtor_account || null,
        }).eq('id', intent_id);

        // Credit consumer wallet (funds arriving from external bank rails)
        const { data: creditRes, error: creditErr } = await supabase.rpc('atomic_credit_balance', {
          _account_id: walletId,
          _amount: amountNum,
          _currency: currency,
        });

        if (creditErr || (creditRes && !creditRes.success)) {
          const msg = creditErr?.message || creditRes?.error || 'Credit failed';
          await supabase.from('pay_by_bank_intents').update({
            status: 'failed', failure_reason: msg,
          }).eq('id', intent_id);
          await supabase.from('payments').update({ status: 'Rejected' }).eq('payment_id', paymentId);
          await supabase.from('pisp_consents').update({ status: 'Rejected' }).eq('consent_id', intent.consent_id);
          await supabase.rpc('trigger_webhooks', {
            _event_type: 'pay_by_bank.failed',
            _event_data: JSON.stringify({ intent_id, payment_id: paymentId, status: 'failed', reason: 'wallet_credit_failed' }),
          });
          return new Response(JSON.stringify({ error: 'wallet_credit_failed', message: msg }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await supabase.from('transactions').insert([{
          user_id,
          account_id: walletId,
          amount: amountNum,
          currency,
          credit_debit_indicator: 'Credit',
          transaction_type: 'pay_by_bank_topup',
          transaction_information: 'Wallet top-up via Pay-by-Bank',
          booking_datetime: new Date().toISOString(),
          status: 'Booked',
          metadata: { intent_id, payment_id: paymentId, source: 'external_bank' },
        }]).then(() => {}, (e) => console.warn('[pay-by-bank] tx insert failed', e));

        await supabase.from('pay_by_bank_intents').update({ status: 'completed' }).eq('id', intent_id);
        await supabase.from('payments').update({ status: 'AcceptedSettlementCompleted' }).eq('payment_id', paymentId);

        await supabase.rpc('trigger_webhooks', {
          _event_type: 'pay_by_bank.completed',
          _event_data: JSON.stringify({
            intent_id, payment_id: paymentId, amount: amountNum, currency,
            target_type: 'consumer_wallet', target_account_id: walletId, status: 'completed',
          }),
        });

        await supabase.from('app_notifications').insert({
          user_id,
          type: 'success',
          title: 'Wallet Topped Up',
          message: `Your wallet was credited ${currency} ${amountNum.toLocaleString()} via Pay-by-Bank.`,
          icon: 'pay_by_bank',
          metadata: { intent_id, payment_id: paymentId },
        });

        const redirectUrl = `${intent.redirect_uri}${intent.redirect_uri.includes('?') ? '&' : '?'}intent_id=${intent_id}&payment_id=${paymentId}&status=completed&state=${encodeURIComponent(intent.state)}`;
        return new Response(JSON.stringify({
          status: 'completed', intent_id, payment_id: paymentId, redirect_url: redirectUrl,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ─── Branch: MERCHANT PAY (consumer KANG wallet → merchant wallet) ───
      // Resolve consumer's primary active KANG wallet
      const { data: walletAccount } = await supabase
        .from('accounts')
        .select('id, currency')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!walletAccount) {
        return new Response(JSON.stringify({
          error: 'no_wallet_account',
          message: 'Consumer wallet not found. Please complete onboarding first.',
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Mark consent Authorised + create pending payment
      await supabase.from('pisp_consents')
        .update({ status: 'Authorised', user_id })
        .eq('consent_id', intent.consent_id);

      const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await supabase.from('payments').insert({
        payment_id: paymentId,
        consent_id: intent.consent_id,
        status: 'AcceptedSettlementInProcess',
        payment_type: 'domestic',
        instructed_amount: JSON.stringify({ amount: String(amountNum), currency }),
        creditor_account: intent.creditor_account ? JSON.stringify({ identification: intent.creditor_account }) : '{}',
        debtor_account: JSON.stringify({ identification: walletAccount.id, scheme: 'KANG_WALLET' }),
      });

      await supabase.from('pay_by_bank_intents').update({
        status: 'authorized',
        customer_user_id: user_id,
        debtor_account: debtor_account || walletAccount.id,
      }).eq('id', intent_id);

      await supabase.rpc('trigger_webhooks', {
        _event_type: 'pay_by_bank.authorized',
        _event_data: JSON.stringify({
          intent_id, payment_id: paymentId, amount: amountNum, currency,
          merchant_id: intent.merchant_id, status: 'authorized',
        }),
      });

      // 1) Atomic debit of consumer wallet (raises on insufficient funds)
      const { data: debitRes, error: debitErr } = await supabase.rpc('atomic_debit_balance', {
        _account_id: walletAccount.id,
        _amount: amountNum,
        _currency: currency,
      });

      if (debitErr || !debitRes?.success) {
        const msg = debitErr?.message || debitRes?.error || 'Debit failed';
        const insufficient = /insufficient/i.test(msg);
        await supabase.from('pay_by_bank_intents').update({
          status: 'failed',
          failure_reason: insufficient ? 'insufficient_funds' : msg,
        }).eq('id', intent_id);
        await supabase.from('payments').update({ status: 'Rejected' }).eq('payment_id', paymentId);
        await supabase.from('pisp_consents').update({ status: 'Rejected' }).eq('consent_id', intent.consent_id);
        await supabase.rpc('trigger_webhooks', {
          _event_type: 'pay_by_bank.failed',
          _event_data: JSON.stringify({
            intent_id, payment_id: paymentId, merchant_id: intent.merchant_id,
            status: 'failed', reason: insufficient ? 'insufficient_funds' : 'debit_failed',
          }),
        });
        return new Response(JSON.stringify({
          error: insufficient ? 'insufficient_funds' : 'debit_failed',
          message: insufficient ? 'Insufficient wallet balance to authorise this payment.' : msg,
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2) Credit the merchant wallet
      const { error: creditErr } = await supabase.rpc('update_merchant_wallet', {
        _merchant_id: intent.merchant_id,
        _currency: currency,
        _available_delta: amountNum,
        _ledger_delta: amountNum,
      });

      if (creditErr) {
        // Reverse the consumer debit
        await supabase.rpc('atomic_credit_balance', {
          _account_id: walletAccount.id,
          _amount: amountNum,
          _currency: currency,
        }).catch((e: any) => console.error('[pay-by-bank] reversal failed', e));

        await supabase.from('pay_by_bank_intents').update({
          status: 'failed',
          failure_reason: `merchant_credit_failed:${creditErr.message}`,
        }).eq('id', intent_id);
        await supabase.from('payments').update({ status: 'Rejected' }).eq('payment_id', paymentId);
        await supabase.rpc('trigger_webhooks', {
          _event_type: 'pay_by_bank.failed',
          _event_data: JSON.stringify({
            intent_id, payment_id: paymentId, merchant_id: intent.merchant_id,
            status: 'failed', reason: 'merchant_credit_failed',
          }),
        });
        return new Response(JSON.stringify({
          error: 'merchant_credit_failed',
          message: 'Could not credit merchant wallet. Your wallet has been refunded.',
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3) Audit transactions (best-effort, non-blocking on errors)
      const nowIso = new Date().toISOString();
      await supabase.from('transactions').insert([
        {
          user_id,
          account_id: walletAccount.id,
          amount: amountNum,
          currency,
          credit_debit_indicator: 'Debit',
          transaction_type: 'pay_by_bank',
          transaction_information: `Pay-by-Bank to ${intent.merchant_name || 'merchant'}`,
          booking_datetime: nowIso,
          status: 'Booked',
          metadata: { intent_id, payment_id: paymentId, merchant_id: intent.merchant_id },
        },
      ]).then(() => {}, (e) => console.warn('[pay-by-bank] tx insert failed', e));

      // 4) Mark everything completed
      await supabase.from('pay_by_bank_intents').update({ status: 'completed' }).eq('id', intent_id);
      await supabase.from('payments').update({ status: 'AcceptedSettlementCompleted' }).eq('payment_id', paymentId);

      await supabase.rpc('trigger_webhooks', {
        _event_type: 'pay_by_bank.completed',
        _event_data: JSON.stringify({
          intent_id, payment_id: paymentId, amount: amountNum, currency,
          merchant_id: intent.merchant_id, status: 'completed',
        }),
      });

      await supabase.from('app_notifications').insert({
        user_id,
        type: 'success',
        title: 'Payment Authorized',
        message: `You paid ${currency} ${amountNum.toLocaleString()} to ${intent.merchant_name || 'merchant'}.`,
        icon: 'pay_by_bank',
        metadata: { intent_id, payment_id: paymentId },
      });

      const redirectUrl = `${intent.redirect_uri}${intent.redirect_uri.includes('?') ? '&' : '?'}intent_id=${intent_id}&payment_id=${paymentId}&status=completed&state=${encodeURIComponent(intent.state)}`;

      return new Response(JSON.stringify({
        status: 'completed',
        intent_id,
        payment_id: paymentId,
        redirect_url: redirectUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── reject ───────────────────────────────────────────────
    if (action === 'reject') {
      // Require authenticated user for state-changing payment rejection
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.replace('Bearer ', '');
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const user_id = authData.user.id;

      const { intent_id } = body;
      if (!intent_id) {
        return new Response(JSON.stringify({ error: 'intent_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: intent } = await supabase
        .from('pay_by_bank_intents')
        .select('*')
        .eq('id', intent_id)
        .single();

      if (!intent) {
        return new Response(JSON.stringify({ error: 'Intent not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase.from('pay_by_bank_intents').update({
        status: 'rejected',
        customer_user_id: user_id,
        failure_reason: 'User rejected payment',
      }).eq('id', intent_id);

      await supabase.from('pisp_consents')
        .update({ status: 'Rejected' })
        .eq('consent_id', intent.consent_id);

      await supabase.rpc('trigger_webhooks', {
        _event_type: 'pay_by_bank.failed',
        _event_data: JSON.stringify({
          intent_id, merchant_id: intent.merchant_id, status: 'rejected', reason: 'User rejected',
        }),
      });

      const redirectUrl = `${intent.redirect_uri}${intent.redirect_uri.includes('?') ? '&' : '?'}intent_id=${intent_id}&status=rejected&error=access_denied&state=${encodeURIComponent(intent.state)}`;

      return new Response(JSON.stringify({
        status: 'rejected',
        intent_id,
        redirect_url: redirectUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── list_intents ─────────────────────────────────────────
    if (action === 'list_intents') {
      const { merchant_id, status: filterStatus, limit = 50 } = body;
      if (!merchant_id) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let query = supabase
        .from('pay_by_bank_intents')
        .select('*')
        .eq('merchant_id', merchant_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) return safeErrorResponse(error, corsHeaders, 'list_intents');

      return new Response(JSON.stringify({ data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── callback (internal — bank connector confirms) ────────
    if (action === 'callback') {
      const { intent_id, final_status, provider_reference } = body;
      if (!intent_id || !final_status) {
        return new Response(JSON.stringify({ error: 'intent_id and final_status required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const mappedStatus = final_status === 'success' ? 'completed' : 'failed';

      await supabase.from('pay_by_bank_intents').update({
        status: mappedStatus,
        metadata: { provider_reference },
      }).eq('id', intent_id);

      const { data: intent } = await supabase
        .from('pay_by_bank_intents')
        .select('*')
        .eq('id', intent_id)
        .single();

      if (intent) {
        const eventType = mappedStatus === 'completed' ? 'pay_by_bank.completed' : 'pay_by_bank.failed';
        await supabase.rpc('trigger_webhooks', {
          _event_type: eventType,
          _event_data: JSON.stringify({
            intent_id, merchant_id: intent.merchant_id, amount: intent.amount,
            currency: intent.currency, status: mappedStatus, provider_reference,
          }),
        });
      }

      return new Response(JSON.stringify({ status: mappedStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'pay-by-bank');
  }
});
