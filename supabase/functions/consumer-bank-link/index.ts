// Consumer Bank Link — verified first-party account linking
// Bank accounts must be verified against a KOB connector/account source or
// Flutterwave account resolution before being persisted as usable funding sources.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const cleanAccount = (value: unknown) => String(value || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 34);
const cleanName = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
const namesMatch = (expected: string, actual: string) => {
  const a = cleanName(expected).toLowerCase();
  const b = cleanName(actual).toLowerCase();
  return !!a && !!b && (a.includes(b) || b.includes(a));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  try {
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ─── GET / authorize_callback (production SCA redirect from bank) ───
    // The bank redirects the user's browser here with link_id + status.
    // No JWT — this is the redirect leg of an OAuth-style flow.
    const qsAction = url.searchParams.get('action');
    if (req.method === 'GET' || qsAction === 'authorize_callback') {
      const linkId = url.searchParams.get('link_id');
      const intentId = url.searchParams.get('intent_id');
      const status = (url.searchParams.get('status') || 'success').toLowerCase();
      const errorCode = url.searchParams.get('error');
      const ok = !errorCode && (status === 'success' || status === 'authorized' || status === 'completed');
      const appOrigin = Deno.env.get('APP_PUBLIC_URL') || (req.headers.get('referer') ? new URL(req.headers.get('referer')!).origin : 'https://kangopenbanking.com');

      // Bank-link confirmation
      if (linkId) {
        const { data: link } = await supa.from('bank_psu_links').select('id, status').eq('id', linkId).maybeSingle();
        if (!link) {
          return Response.redirect(`${appOrigin}/app/linked-accounts?bank_link=not_found`, 302);
        }
        await supa.from('bank_psu_links').update({
          status: ok ? 'active' : 'revoked',
          linked_at: ok ? new Date().toISOString() : null,
        }).eq('id', linkId);
        return Response.redirect(`${appOrigin}/app/linked-accounts?bank_link=${ok ? 'success' : 'failed'}`, 302);
      }

      // Pay-by-bank intent SCA completion (forward to /pay/authorize for the in-app authorize action)
      if (intentId) {
        return Response.redirect(`${appOrigin}/pay/authorize?intent_id=${intentId}&sca=${ok ? 'success' : 'failed'}`, 302);
      }

      return json({ error: 'missing_link_id_or_intent_id' }, 400);
    }

    // ─── POST actions require JWT ───
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ─── LIST banks available for verified linking ───
    if (action === 'list_banks') {
      const { data: banks } = await supa
        .from('banks')
        .select('id, display_name, status, bank_code, swift_bic')
        .eq('status', 'active')
        .order('display_name');
      const directory = (banks || []).map((b: any) => ({
        id: b.id,
        code: b.id,
        display_name: b.display_name,
        provider: 'kob',
        bank_code: b.bank_code,
        swift_bic: b.swift_bic,
        status: b.status,
      }));

      const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (flutterwaveSecretKey) {
        try {
          const fwRes = await fetch('https://api.flutterwave.com/v3/banks/CM', {
            headers: { Authorization: `Bearer ${flutterwaveSecretKey}`, 'Content-Type': 'application/json' },
          });
          const fwData = await fwRes.json().catch(() => ({}));
          if (fwRes.ok && Array.isArray(fwData?.data)) {
            for (const bank of fwData.data) {
              const name = cleanName(bank.name);
              if (!name) continue;
              const duplicate = directory.some((b) => b.display_name.toLowerCase() === name.toLowerCase());
              if (!duplicate) {
                directory.push({
                  id: `flutterwave:${bank.code}`,
                  code: String(bank.code),
                  display_name: name,
                  provider: 'flutterwave',
                  bank_code: String(bank.code),
                  status: 'active',
                });
              }
            }
          }
        } catch (err) {
          console.warn('Flutterwave bank list unavailable', err);
        }
      }

      return json({ banks: directory });
    }

    // ─── LIST current links ───
    if (action === 'list_links') {
      const { data: links } = await supa
        .from('bank_psu_links')
        .select('id, bank_id, status, linked_at, created_at, banks(display_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return json({ links: links || [] });
    }

    // ─── LINK verified bank account ───
    if (action === 'link_account') {
      const bankId = String(body.bank_id || '');
      const provider = String(body.provider || 'kob').toLowerCase();
      const accountNumber = cleanAccount(body.account_number);
      const submittedName = cleanName(body.account_name);
      const branchCode = cleanAccount(body.branch_code).slice(0, 12);

      if (!accountNumber || accountNumber.length < 6) return json({ error: 'invalid_account_number', message: 'Enter a valid bank account number.' }, 400);
      if (!submittedName) return json({ error: 'missing_account_name', message: 'Enter the account holder name registered with the bank.' }, 400);
      if (!['kob', 'flutterwave'].includes(provider)) return json({ error: 'invalid_provider', message: 'Bank linking must use Kang Open Banking or Flutterwave verification.' }, 400);

      let verifiedName = '';
      let bankName = '';
      let externalBankCode = bankId;
      let verificationProvider = provider;
      let metadata: Record<string, unknown> = {};

      if (provider === 'kob') {
        if (!isUuid(bankId)) return json({ error: 'invalid_bank_id', message: 'Select a Kang Open Banking partner bank.' }, 400);
        const { data: bank } = await supa.from('banks').select('id, display_name, status, bank_code, swift_bic').eq('id', bankId).maybeSingle();
        if (!bank || bank.status !== 'active') return json({ error: 'bank_unavailable', message: 'This bank is not available for verified linking.' }, 404);

        const { data: bankAccount } = await supa
          .from('bank_sourced_accounts')
          .select('id, external_account_id, identification_value, status, currency, account_type, nickname, bank_customers(name)')
          .eq('bank_id', bankId)
          .eq('identification_value', accountNumber)
          .eq('status', 'active')
          .maybeSingle();

        const { data: kobAccount } = bankAccount ? { data: null } : await supa
          .from('accounts')
          .select('id, account_id, account_holder_name, is_active, currency, account_type, account_subtype, institution_id')
          .eq('institution_id', bankId)
          .eq('identification_value', accountNumber)
          .eq('is_active', true)
          .maybeSingle();

        verifiedName = cleanName((bankAccount as any)?.bank_customers?.name || (kobAccount as any)?.account_holder_name || '');
        if (!verifiedName || !namesMatch(verifiedName, submittedName)) {
          return json({ error: 'bank_verification_failed', message: 'The bank could not verify these account details. Check the bank, account number, and account holder name.' }, 422);
        }

        bankName = bank.display_name;
        externalBankCode = bank.id;
        metadata = {
          verification_provider: 'kob',
          bank_id: bank.id,
          bank_code: bank.bank_code,
          swift_bic: bank.swift_bic,
          source_account_id: (bankAccount as any)?.id || (kobAccount as any)?.id,
          source: bankAccount ? 'bank_sourced_accounts' : 'accounts',
        };
      } else {
        const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
        if (!flutterwaveSecretKey) return json({ error: 'verification_unavailable', message: 'Flutterwave bank verification is not configured.' }, 503);
        if (!bankId || bankId.length > 20) return json({ error: 'invalid_bank_code', message: 'Select a Flutterwave-supported bank.' }, 400);

        const fwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
          method: 'POST',
          headers: { Authorization: `Bearer ${flutterwaveSecretKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_number: accountNumber, account_bank: bankId }),
        });
        const fwData = await fwRes.json().catch(() => ({}));
        if (!fwRes.ok || fwData?.status !== 'success') {
          return json({ error: 'bank_verification_failed', message: fwData?.message || 'The bank could not verify these account details.' }, 422);
        }

        verifiedName = cleanName(fwData?.data?.account_name || '');
        if (!namesMatch(verifiedName, submittedName)) {
          return json({ error: 'bank_name_mismatch', message: 'The account holder name does not match the bank record.' }, 422);
        }
        bankName = cleanName(body.bank_name) || `Flutterwave Bank ${bankId}`;
        externalBankCode = bankId;
        metadata = {
          verification_provider: 'flutterwave',
          flutterwave_bank_code: bankId,
          resolved_account_number: fwData?.data?.account_number,
        };
      }

      const now = new Date().toISOString();
      const accountData = {
        user_id: user.id,
        institution_id: null,
        account_type: 'bank_account',
        account_number: accountNumber,
        account_name: verifiedName,
        provider_name: bankName,
        provider_type: 'bank',
        last4: accountNumber.slice(-4),
        is_active: true,
        status: 'active',
        verification_status: 'verified',
        verification_provider: verificationProvider,
        verified_at: now,
        external_bank_code: externalBankCode,
        external_account_ref: accountNumber,
        verification_reference: crypto.randomUUID(),
        metadata: { ...metadata, branch_code: branchCode || null, linked_via: 'consumer-bank-link' },
      };

      const { data: activeAccounts } = await supa.from('customer_linked_accounts').select('id').eq('user_id', user.id).eq('is_active', true).eq('status', 'active');
      const hasPrimary = (activeAccounts || []).length > 0;
      const { data: existing } = await supa
        .from('customer_linked_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('account_type', 'bank_account')
        .eq('verification_provider', verificationProvider)
        .eq('external_bank_code', externalBankCode)
        .eq('external_account_ref', accountNumber)
        .eq('is_active', true)
        .eq('status', 'active')
        .maybeSingle();
      if (existing) return json({ error: 'already_linked', message: 'This verified bank account is already linked.' }, 409);

      const { data: removals } = await supa.from('customer_linked_accounts').select('id').eq('user_id', user.id).eq('status', 'removed').limit(1);
      if (removals?.length) {
        const { error } = await supa.from('linked_account_change_requests').insert({
          user_id: user.id,
          request_type: 'add_after_removal',
          requested_account_data: { ...accountData, is_primary: !hasPrimary },
          status: 'pending',
        });
        if (error) return json({ error: 'request_failed', detail: error.message }, 500);
        return json({ status: 'pending_review', bank_name: bankName, account_name: verifiedName, last4: accountNumber.slice(-4) });
      }

      const { data: inserted, error: insertErr } = await supa
        .from('customer_linked_accounts')
        .insert({ ...accountData, is_primary: !hasPrimary })
        .select('id, provider_name, account_name, last4')
        .single();
      if (insertErr) return json({ error: 'link_failed', detail: insertErr.message }, 500);

      await supa.from('profiles').update({ linked_account_type: 'bank_account' }).eq('id', user.id);
      return json({ status: 'active', account: inserted });
    }

    // ─── REVOKE ───
    if (action === 'revoke') {
      const linkId = body.link_id as string;
      if (!linkId) return json({ error: 'missing_link_id' }, 400);
      const { error } = await supa
        .from('customer_linked_accounts')
        .update({ status: 'removed', is_active: false, removed_at: new Date().toISOString() })
        .eq('id', linkId)
        .eq('user_id', user.id);
      if (error) return json({ error: 'revoke_failed', detail: error.message }, 500);
      return json({ link_id: linkId, status: 'removed' });
    }

    return json({ error: 'invalid_action', message: 'Use list_banks | list_links | link_account | revoke' }, 400);
  } catch (err: any) {
    console.error('consumer-bank-link error:', err);
    return json({ error: 'internal_error', detail: err?.message }, 500);
  }
});
