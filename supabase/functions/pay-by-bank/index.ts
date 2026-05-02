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
      const { merchant_id, amount, currency, redirect_uri, state, description, creditor_account, creditor_name, customer_email } = body;

      if (!merchant_id || !amount || !redirect_uri || !state) {
        return new Response(JSON.stringify({ error: 'Missing required fields: merchant_id, amount, redirect_uri, state' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify merchant exists
      const { data: merchant, error: merchantErr } = await supabase
        .from('gateway_merchants')
        .select('id, business_name, logo_url')
        .eq('id', merchant_id)
        .single();

      if (merchantErr || !merchant) {
        return new Response(JSON.stringify({ error: 'Merchant not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create PISP consent
      const consentId = `PBB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: consentErr } = await supabase.from('pisp_consents').insert({
        consent_id: consentId,
        client_id: merchant_id,
        status: 'AwaitingAuthorisation',
        creditor_account: creditor_account ? JSON.stringify({ identification: creditor_account }) : '{}',
        creditor_name: creditor_name || merchant.business_name,
        instructed_amount: JSON.stringify({ amount: String(amount), currency: currency || 'XAF' }),
        currency_of_transfer: currency || 'XAF',
        expires_at: expiresAt,
        risk: JSON.stringify({ payment_context: 'pay_by_bank' }),
      });

      if (consentErr) {
        console.error('Consent creation failed:', consentErr);
        return safeErrorResponse(consentErr, corsHeaders, 'create_consent');
      }

      const authUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/pay/authorize?intent_id=PLACEHOLDER&state=${encodeURIComponent(state)}`;

      // Create pay_by_bank_intent
      const { data: intent, error: intentErr } = await supabase
        .from('pay_by_bank_intents')
        .insert({
          merchant_id,
          consent_id: consentId,
          amount,
          currency: currency || 'XAF',
          redirect_uri,
          state,
          status: 'awaiting_auth',
          merchant_name: merchant.business_name,
          merchant_logo_url: merchant.logo_url,
          creditor_account,
          creditor_name: creditor_name || merchant.business_name,
          description,
          expires_at: expiresAt,
          customer_email,
        })
        .select('id')
        .single();

      if (intentErr || !intent) {
        return safeErrorResponse(intentErr, corsHeaders, 'create_intent');
      }

      // Update authorization_url with actual intent_id
      const finalAuthUrl = `${req.headers.get('origin') || 'https://kangopenbanking.com'}/pay/authorize?intent_id=${intent.id}&state=${encodeURIComponent(state)}`;
      await supabase.from('pay_by_bank_intents').update({ authorization_url: finalAuthUrl }).eq('id', intent.id);

      return new Response(JSON.stringify({
        intent_id: intent.id,
        consent_id: consentId,
        authorization_url: finalAuthUrl,
        expires_at: expiresAt,
        status: 'awaiting_auth',
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

      // Update consent to Authorised
      await supabase.from('pisp_consents')
        .update({ status: 'Authorised', user_id })
        .eq('consent_id', intent.consent_id);

      // Create payment record
      const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await supabase.from('payments').insert({
        payment_id: paymentId,
        consent_id: intent.consent_id,
        status: 'AcceptedSettlementInProcess',
        payment_type: 'domestic',
        instructed_amount: JSON.stringify({ amount: String(intent.amount), currency: intent.currency }),
        creditor_account: intent.creditor_account ? JSON.stringify({ identification: intent.creditor_account }) : '{}',
        debtor_account: debtor_account ? JSON.stringify({ identification: debtor_account }) : '{}',
      });

      // Update intent
      await supabase.from('pay_by_bank_intents').update({
        status: 'authorized',
        customer_user_id: user_id,
        debtor_account,
      }).eq('id', intent_id);

      // Move to submitted → processing
      await supabase.from('pay_by_bank_intents').update({ status: 'submitted' }).eq('id', intent_id);

      // Fire submitted webhook
      await supabase.rpc('trigger_webhooks', {
        _event_type: 'pay_by_bank.submitted',
        _event_data: JSON.stringify({
          intent_id, payment_id: paymentId, amount: intent.amount, currency: intent.currency,
          merchant_id: intent.merchant_id, status: 'submitted',
        }),
      });

      await supabase.from('pay_by_bank_intents').update({ status: 'processing' }).eq('id', intent_id);

      // Fire webhook
      await supabase.rpc('trigger_webhooks', {
        _event_type: 'pay_by_bank.authorized',
        _event_data: JSON.stringify({
          intent_id, payment_id: paymentId, amount: intent.amount, currency: intent.currency,
          merchant_id: intent.merchant_id, status: 'authorized',
        }),
      });

      // For KOB wallet / internal: auto-complete
      await supabase.from('pay_by_bank_intents').update({ status: 'completed' }).eq('id', intent_id);
      await supabase.from('payments').update({ status: 'AcceptedSettlementCompleted' }).eq('payment_id', paymentId);

      await supabase.rpc('trigger_webhooks', {
        _event_type: 'pay_by_bank.completed',
        _event_data: JSON.stringify({
          intent_id, payment_id: paymentId, amount: intent.amount, currency: intent.currency,
          merchant_id: intent.merchant_id, status: 'completed',
        }),
      });

      // Send notification to user
      await supabase.from('app_notifications').insert({
        user_id,
        type: 'success',
        title: 'Payment Authorized',
        message: `You authorized a payment of ${intent.currency} ${Number(intent.amount).toLocaleString()} to ${intent.merchant_name || 'merchant'}.`,
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
      const { intent_id, user_id } = body;
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
