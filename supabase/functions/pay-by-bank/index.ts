import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/errors.ts';
import { createFlutterwaveCharge } from '../_shared/gateway-adapters.ts';


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

    // ─── preflight_rails ──────────────────────────────────────
    // Returns which Pay-by-Bank rails are available for a given bank +
    // currency, so the client can disable/hide unsupported options
    // before the user commits. Mirrors Plaid/Token capability probes.
    if (action === 'preflight_rails') {
      const { bank, currency } = body as { bank?: { code?: string; name?: string; network?: string }; currency?: string };
      const ccy = String(currency || 'XAF').toUpperCase();

      // KOB partner rail: only if institution exists & approved
      let kobSupported = false;
      let kobReason: string | undefined;
      if (bank?.code) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('id, status')
          .eq('id', bank.code)
          .maybeSingle();
        if (inst && inst.status === 'approved') kobSupported = true;
        else kobReason = 'Bank is not a KOB partner — direct account debit unavailable.';
      } else if (bank?.network === 'kob') {
        kobSupported = true;
      } else {
        kobReason = 'No bank identifier supplied.';
      }

      // Flutterwave hosted (card + franco MoMo) — supported for XAF/XOF/NGN
      const fwSupported = ['XAF', 'XOF', 'NGN', 'GHS', 'KES'].includes(ccy);
      const fwReason = fwSupported ? undefined : `Hosted checkout is not available for ${ccy} in this region.`;

      // Native Flutterwave bank_transfer — NGN only
      const fwBankTransfer = ccy === 'NGN';
      const fwBankTransferReason = fwBankTransfer ? undefined
        : 'Native bank transfer (virtual account) is only available for NGN. XAF/XOF must use hosted checkout or a KOB partner bank.';

      const rails = [
        {
          rail: 'kob_pisp',
          provider: 'kob',
          label: 'Direct bank account debit (PSD2 PISP)',
          supported: kobSupported,
          requires_linked_account: true,
          reason: kobSupported ? undefined : kobReason,
        },
        {
          rail: 'flutterwave_hosted',
          provider: 'flutterwave',
          label: 'Bank card or Mobile Money (Flutterwave hosted)',
          supported: fwSupported,
          requires_linked_account: false,
          reason: fwReason,
          payment_options: ccy === 'NGN' ? 'account,banktransfer,card,ussd' : 'card,mobilemoneyfranco',
        },
        {
          rail: 'flutterwave_bank_transfer',
          provider: 'flutterwave',
          label: 'Virtual bank account (NGN only)',
          supported: fwBankTransfer,
          requires_linked_account: false,
          reason: fwBankTransferReason,
        },
      ];

      const recommended = rails.find(r => r.rail === 'kob_pisp' && r.supported)?.rail
        ?? rails.find(r => r.rail === 'flutterwave_hosted' && r.supported)?.rail
        ?? rails.find(r => r.supported)?.rail
        ?? null;

      return new Response(JSON.stringify({
        currency: ccy,
        bank: bank || null,
        rails,
        recommended_rail: recommended,
        any_supported: rails.some(r => r.supported),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    // ─── list_payment_banks ────────────────────────────────────
    // Returns banks usable for Pay-by-Bank, tagged by rail.
    if (action === 'list_payment_banks') {
      const banks: Array<{ code: string; name: string; rail: 'kob' | 'flutterwave'; logo_url: string | null; bank_code?: string | null; swift_bic?: string | null }> = [];

      // KOB partner banks (only approved + with healthy connector configs)
      try {
        const { data: kob } = await supabase
          .from('institutions')
          .select('id, institution_name, logo_url, status')
          .eq('status', 'approved')
          .order('institution_name');
        (kob || []).forEach((i: any) => banks.push({
          code: i.id,
          name: i.institution_name,
          rail: 'kob',
          logo_url: i.logo_url || null,
        }));
      } catch (e) { console.warn('[pay-by-bank] kob list failed', e); }

      // Flutterwave banks (Cameroon)
      try {
        const { data: fw } = await supabase.functions.invoke('flutterwave-list-banks', { body: { country: 'CM' } });
        (fw?.banks || []).forEach((b: any) => {
          // dedupe by name vs KOB
          const exists = banks.some(x => x.name.toLowerCase() === String(b.name || '').toLowerCase());
          if (!exists && b.code && b.name) {
            banks.push({
              code: String(b.code),
              name: String(b.name),
              rail: 'flutterwave',
              logo_url: b.logo || b.logo_url || null,
              bank_code: String(b.code),
            });
          }
        });
      } catch (e) { console.warn('[pay-by-bank] flutterwave list failed', e); }

      return new Response(JSON.stringify({
        banks,
        kob_available: banks.some(b => b.rail === 'kob'),
        flutterwave_available: banks.some(b => b.rail === 'flutterwave'),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
        const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
        if (authErr || !authData?.user) {
          console.warn('[pay-by-bank] create_intent auth failed', authErr);
          return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Please sign in again before starting Pay by Bank.' }), {
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

      // ─── SECURITY: For consumer wallet top-ups via the KOB rail, the
      // user MUST have a verified linked account at the chosen source bank
      // (sandbox banks have no live OAuth, so the linked-account check is
      // our proof of ownership). For the Flutterwave rail, the user
      // authenticates directly on Flutterwave's hosted page — no pre-link
      // required, mirroring Capital One / Trustly / Token PSD2 flows. ──
      let linkedAccountId: string | null = null;
      let linkedLast4: string | null = null;
      const sourceRail: 'kob' | 'flutterwave' | null =
        source_bank?.network === 'flutterwave' ? 'flutterwave'
        : source_bank?.network === 'kob' ? 'kob'
        : null;

      if (target_type === 'consumer_wallet') {
        if (!source_bank || (!source_bank.name && !source_bank.code)) {
          return new Response(JSON.stringify({
            error: 'source_bank_required',
            message: 'Please select the bank you are paying from.',
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (sourceRail === 'kob') {
          let matched: any = null;
          if (source_bank.code) {
            const { data } = await supabase
              .from('customer_linked_accounts')
              .select('id, account_number, last4, provider_name, institution_id, external_bank_code, verification_status')
              .eq('user_id', resolvedCustomerUserId)
              .eq('status', 'active')
              .or(`institution_id.eq.${source_bank.code},external_bank_code.eq.${source_bank.code}`)
              .eq('verification_status', 'verified')
              .limit(1);
            matched = data?.[0] || null;
          }
          if (!matched && source_bank.name) {
            const safeName = String(source_bank.name).replace(/[%_,]/g, ' ').trim().slice(0, 60);
            const { data } = await supabase
              .from('customer_linked_accounts')
              .select('id, account_number, last4, provider_name, institution_id, external_bank_code, verification_status')
              .eq('user_id', resolvedCustomerUserId)
              .eq('status', 'active')
              .eq('verification_status', 'verified')
              .ilike('provider_name', `%${safeName}%`)
              .limit(1);
            matched = data?.[0] || null;
          }

          if (!matched) {
            const ccy = String(currency || 'XAF').toUpperCase();
            const hostedFallback = ['XAF', 'XOF', 'NGN', 'GHS', 'KES'].includes(ccy);
            return new Response(JSON.stringify({
              error: 'bank_not_linked',
              action: 'link_account',
              message: `You don't have a verified account at ${source_bank.name}. Link your bank account first to authorise a Pay-by-Bank payment.`,
              fallback: hostedFallback ? {
                rail: 'flutterwave_hosted',
                provider: 'flutterwave',
                label: 'Continue via secure hosted checkout (card or Mobile Money)',
                payment_options: ccy === 'NGN' ? 'account,banktransfer,card,ussd' : 'card,mobilemoneyfranco',
                retry_with: { source_bank: { ...source_bank, network: 'flutterwave' } },
              } : null,
            }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }


          linkedAccountId = matched.id;
          linkedLast4 = matched.last4 || (matched.account_number ? String(matched.account_number).slice(-4) : null);
        }
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
          metadata: source_bank
            ? { source_bank, rail: sourceRail, linked_account_id: linkedAccountId, linked_last4: linkedLast4 }
            : {},

        })
        .select('id')
        .single();

      if (intentErr || !intent) {
        return safeErrorResponse(intentErr, corsHeaders, 'create_intent');
      }

      // Branch authorisation URL by rail:
      //   - KOB: internal authorize page (acts as PISP authorize endpoint;
      //     verifies linked-account ownership).
      //   - Flutterwave: real FW hosted bank-transfer page — user enters
      //     their bank credentials on FW's domain and is redirected back.
      let finalAuthUrl: string;
      if (sourceRail === 'flutterwave' && target_type === 'consumer_wallet') {
        // ─── CEMAC Pay-by-Bank (non-KOB-partner banks) ────────────
        // Flutterwave's native `bank_transfer` (virtual NUBAN) only
        // supports NGN — it returns "This payment method is not allowed
        // for this currency" for XAF/XOF. The only working XAF path is
        // the Standard hosted checkout, which lets the user pay from
        // their bank-issued debit card or mobile-money wallet (both
        // funded from the chosen bank account). This mirrors the
        // Eversend / Chipper / NALA fallback when direct PISP is
        // unavailable for a given bank.
        try {
          const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
          if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

          const flwTxRef = `pbb_${intent.id.replace(/-/g, '').slice(0, 16)}_${Date.now().toString().slice(-6)}`;
          const ccy = (currency || 'XAF').toUpperCase();
          // XAF/XOF: card + franco mobile money (both debit a bank-funded source).
          // NGN: include account & banktransfer (true Pay-by-Bank).
          const paymentOptions = ccy === 'NGN'
            ? 'account,banktransfer,card,ussd'
            : 'card,mobilemoneyfranco';

          const returnWithIntent = `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}intent_id=${intent.id}&source=pay_by_bank`;

          const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${FLW_SECRET}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tx_ref: flwTxRef,
              amount: Number(amount),
              currency: ccy,
              redirect_url: returnWithIntent,
              payment_options: paymentOptions,
              customer: {
                email: customer_email || 'customer@kob.cm',
                name: creditor_name || 'KANG Customer',
              },
              customizations: {
                title: source_bank?.name ? `Pay from ${source_bank.name}` : 'KANG Pay by Bank',
                description: description || 'KANG Wallet top-up',
              },
              meta: {
                pay_by_bank_intent_id: intent.id,
                bank_code: source_bank?.code || null,
                bank_name: source_bank?.name || null,
              },
            }),
          });
          const flwData = await flwRes.json();
          console.log('[pay-by-bank][flw] status:', flwData?.status, 'msg:', flwData?.message);

          if (flwData?.status !== 'success' || !flwData?.data?.link) {
            throw new Error(flwData?.message || 'Flutterwave did not return a checkout link');
          }

          finalAuthUrl = flwData.data.link as string;
          await supabase.from('pay_by_bank_intents').update({
            authorization_url: finalAuthUrl,
            metadata: {
              source_bank, rail: sourceRail,
              flw_tx_ref: flwTxRef,
              flw_payment_options: paymentOptions,
            },
          }).eq('id', intent.id);
        } catch (e: any) {
          console.error('[pay-by-bank] flutterwave charge failed', e);
          const raw = String(e?.message || e);
          const friendly = /not allowed for this currency/i.test(raw)
            ? 'This bank is not yet available for direct Pay-by-Bank in XAF. Please use a KOB partner bank, Mobile Money, or pay with your bank card.'
            : 'Could not start Pay-by-Bank with this bank. Please try another bank or try again later.';
          await supabase.from('pay_by_bank_intents').update({
            status: 'failed', failure_reason: `flutterwave_init_failed:${raw}`,
          }).eq('id', intent.id);
          return new Response(JSON.stringify({
            error: 'flutterwave_init_failed',
            message: friendly,
            detail: raw,
          }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        finalAuthUrl = `${req.headers.get('origin') || 'https://kangopenbanking.com'}/pay/authorize?intent_id=${intent.id}&state=${encodeURIComponent(state)}`;
        await supabase.from('pay_by_bank_intents').update({ authorization_url: finalAuthUrl }).eq('id', intent.id);
      }


      // Detailed rail descriptor so integrators can render the right UI
      // and troubleshoot which rail handled the intent.
      const ccyOut = String(currency || 'XAF').toUpperCase();
      const railDescriptor = sourceRail === 'flutterwave'
        ? {
            rail: 'flutterwave_hosted',
            provider: 'flutterwave',
            payment_options: ccyOut === 'NGN' ? 'account,banktransfer,card,ussd' : 'card,mobilemoneyfranco',
            requires_linked_account: false,
          }
        : sourceRail === 'kob'
          ? { rail: 'kob_pisp', provider: 'kob', requires_linked_account: true }
          : { rail: null, provider: null, requires_linked_account: false };

      return new Response(JSON.stringify({
        intent_id: intent.id,
        consent_id: consentId,
        authorization_url: finalAuthUrl,
        expires_at: expiresAt,
        status: 'awaiting_auth',
        target_type,
        rail: sourceRail,
        rail_descriptor: railDescriptor,
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

      const meta = (intent.metadata || {}) as any;
      const rail = meta.rail as string | null;
      const ccyOut = String(intent.currency || 'XAF').toUpperCase();
      const rail_descriptor = rail === 'flutterwave'
        ? { rail: 'flutterwave_hosted', provider: 'flutterwave',
            payment_options: meta.flw_payment_options || (ccyOut === 'NGN' ? 'account,banktransfer,card,ussd' : 'card,mobilemoneyfranco'),
            requires_linked_account: false }
        : rail === 'kob'
          ? { rail: 'kob_pisp', provider: 'kob', requires_linked_account: true }
          : { rail: null, provider: null, requires_linked_account: false };

      return new Response(JSON.stringify({ ...intent, rail, rail_descriptor }), {

        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── authorize ────────────────────────────────────────────
    if (action === 'authorize') {
      // Require authenticated user for state-changing payment authorization
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.replace('Bearer ', '');
      const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const authedUserId = authData.user.id;

      const { intent_id, debtor_account, bank_verification } = body;
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

        // ─── SECURITY: Verify the user actually controls the source bank
        // account by matching the linked account stored on the intent and
        // requiring confirmation of its last 4 digits. ─────────────────
        const intentMeta = (intent.metadata || {}) as any;
        const expectedLinkedId = intentMeta.linked_account_id as string | undefined;
        const expectedLast4 = intentMeta.linked_last4 as string | undefined;
        if (!expectedLinkedId) {
          return new Response(JSON.stringify({
            error: 'bank_not_linked',
            action: 'link_account',
            message: 'Source bank is not linked. Please link this bank account before authorising.',
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Confirm the linked account still belongs to this user and is active
        const { data: linkRow } = await supabase
          .from('customer_linked_accounts')
          .select('id, user_id, status, last4, account_number, verification_status')
          .eq('id', expectedLinkedId)
          .maybeSingle();
        if (!linkRow || linkRow.user_id !== user_id || linkRow.status !== 'active' || linkRow.verification_status !== 'verified') {
          return new Response(JSON.stringify({
            error: 'linked_account_invalid',
            message: 'The selected bank account is no longer linked or active. Please link it again.',
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const submittedLast4 = String(bank_verification?.last4 || '').trim();
        const trueLast4 = String(expectedLast4 || linkRow.last4 || (linkRow.account_number ? String(linkRow.account_number).slice(-4) : '')).trim();
        if (!/^\d{4}$/.test(submittedLast4) || !trueLast4 || submittedLast4 !== trueLast4) {
          return new Response(JSON.stringify({
            error: 'bank_verification_failed',
            message: 'Bank account verification failed. Enter the last 4 digits of your linked bank account.',
          }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
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

    // ─── verify_external (Flutterwave-rail reconciliation) ────
    // Called by the frontend when the user returns from FW. Verifies the
    // FW transaction by tx_ref and, on success, credits the wallet using
    // the same atomic path as the KOB rail.
    if (action === 'verify_external') {
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.replace('Bearer ', '');
      const { data: authData } = await supabase.auth.getUser(jwt);
      if (!authData?.user) {
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
        .from('pay_by_bank_intents').select('*').eq('id', intent_id).single();
      if (!intent) {
        return new Response(JSON.stringify({ error: 'intent_not_found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (intent.customer_user_id && intent.customer_user_id !== user_id) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (intent.status === 'completed') {
        return new Response(JSON.stringify({ status: 'completed', intent_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const meta = (intent.metadata || {}) as any;
      const txRef = meta.flw_tx_ref as string | undefined;
      if (!txRef) {
        return new Response(JSON.stringify({ error: 'not_a_flutterwave_intent' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify with Flutterwave
      const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (!FLW_SECRET) {
        return new Response(JSON.stringify({ error: 'flutterwave_not_configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
        headers: { Authorization: `Bearer ${FLW_SECRET}` },
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      const flwStatus = String(verifyData?.data?.status || '').toLowerCase();

      if (flwStatus !== 'successful') {
        return new Response(JSON.stringify({
          status: flwStatus || 'pending',
          intent_id,
          message: flwStatus ? `Bank reports status: ${flwStatus}` : 'Waiting for your bank to confirm the transfer.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Idempotent credit
      const walletId = intent.target_account_id;
      const amountNum = Number(intent.amount);
      const currency = intent.currency || 'XAF';

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
        return new Response(JSON.stringify({ error: 'wallet_credit_failed', message: msg }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase.from('transactions').insert([{
        user_id, account_id: walletId, amount: amountNum, currency,
        credit_debit_indicator: 'Credit', transaction_type: 'pay_by_bank_topup',
        transaction_information: 'Wallet top-up via Pay-by-Bank (Flutterwave)',
        booking_datetime: new Date().toISOString(), status: 'Booked',
        metadata: { intent_id, flw_tx_ref: txRef, source: 'flutterwave_bank' },
      }]).then(() => {}, (e) => console.warn('[pay-by-bank] tx insert failed', e));

      await supabase.from('pay_by_bank_intents').update({ status: 'completed' }).eq('id', intent_id);

      await supabase.from('app_notifications').insert({
        user_id, type: 'success',
        title: 'Wallet Topped Up',
        message: `Your wallet was credited ${currency} ${amountNum.toLocaleString()} via Pay-by-Bank.`,
        icon: 'pay_by_bank', metadata: { intent_id, flw_tx_ref: txRef },
      }).then(() => {}, () => {});

      return new Response(JSON.stringify({ status: 'completed', intent_id }), {
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
