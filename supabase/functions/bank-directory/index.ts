import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action');

    // Auth check (some actions are public)
    const publicActions = ['list_directory'];
    let user: any = null;
    let isAdmin = false;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: u } } = await supabase.auth.getUser(token);
      user = u;
      if (user) {
        const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        isAdmin = !!hasAdmin;
      }
    }

    if (!publicActions.includes(action) && !user) {
      return errorResponse('Unauthorized', 401);
    }

    switch (action) {
      // ─── Phase 1: Bank Directory ───
      case 'register_bank': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { legal_name, display_name, short_code, swift_bic, bank_code, integration_mode, contact_email, support_phone } = body;
        if (!legal_name || !display_name || !short_code) return errorResponse('Missing required fields: legal_name, display_name, short_code', 400);

        const { data, error } = await supabase.from('banks').insert({
          legal_name, display_name, short_code, swift_bic, bank_code,
          integration_mode: integration_mode || 'connector_push',
          contact_email, support_phone
        }).select().single();

        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }

      case 'list_banks': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { status: filterStatus, limit = 50, offset = 0 } = body;
        let query = supabase.from('banks').select('*', { count: 'exact' });
        if (filterStatus) query = query.eq('status', filterStatus);
        const { data, error, count } = await query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ banks: data, total: count });
      }

      case 'get_bank': {
        const { bank_id } = body;
        if (!bank_id) return errorResponse('Missing bank_id', 400);
        const { data, error } = await supabase.from('banks').select('*').eq('id', bank_id).single();
        if (error) return errorResponse('Bank not found', 404);
        return jsonResponse(data);
      }

      case 'update_bank': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id, ...updates } = body;
        delete updates.action;
        if (!bank_id) return errorResponse('Missing bank_id', 400);
        const { data, error } = await supabase.from('banks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', bank_id).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }

      case 'submit_bank': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id } = body;
        const { data, error } = await supabase.from('banks').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', bank_id).eq('status', 'draft').select().single();
        if (error) return errorResponse('Bank not found or not in draft status', 400);
        return jsonResponse(data);
      }

      case 'approve_bank': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id } = body;
        const { data, error } = await supabase.from('banks').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', bank_id).eq('status', 'submitted').select().single();
        if (error) return errorResponse('Bank not found or not in submitted status', 400);
        return jsonResponse(data);
      }

      case 'suspend_bank': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id } = body;
        const { data, error } = await supabase.from('banks').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', bank_id).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }

      case 'list_directory': {
        const { data, error } = await supabase.from('banks').select('id, display_name, short_code, swift_bic, bank_code, country, integration_mode').eq('status', 'active').order('display_name');
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ banks: data });
      }

      // ─── Connector Management ───
      case 'register_connector': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id, name, environment, base_url, connector_type } = body;
        if (!bank_id || !name) return errorResponse('Missing bank_id or name', 400);
        const { data, error } = await supabase.from('bank_connector_instances').insert({
          bank_id, name, environment: environment || 'sandbox', base_url, connector_type: connector_type || 'rest'
        }).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }

      case 'list_connectors': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id } = body;
        let query = supabase.from('bank_connector_instances').select('*, bank_connector_health(*), bank_connector_certificates(id, thumbprint, valid_until, revoked_at)');
        if (bank_id) query = query.eq('bank_id', bank_id);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ connectors: data });
      }

      case 'upload_certificate': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id, instance_id, certificate_pem, thumbprint, valid_from, valid_until } = body;
        if (!bank_id || !instance_id || !certificate_pem || !thumbprint) return errorResponse('Missing required cert fields', 400);
        const { data, error } = await supabase.from('bank_connector_certificates').insert({
          bank_id, instance_id, certificate_pem, thumbprint, valid_from, valid_until
        }).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }

      case 'connector_health': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { instance_id } = body;
        if (!instance_id) return errorResponse('Missing instance_id', 400);
        const { data, error } = await supabase.from('bank_connector_health').select('*').eq('instance_id', instance_id).single();
        if (error) return jsonResponse({ status: 'unknown', instance_id });
        return jsonResponse(data);
      }

      // ─── Phase 2: Data Ingestion ───
      case 'ingest_accounts': {
        const { bank_id, accounts, correlation_id } = body;
        if (!bank_id || !accounts?.length) return errorResponse('Missing bank_id or accounts', 400);
        console.log(`[INGEST] accounts bank=${bank_id} count=${accounts.length} corr=${correlation_id}`);

        const records = accounts.map((a: any) => ({
          bank_id,
          external_account_id: a.external_account_id,
          customer_id: a.customer_id || null,
          account_type: a.account_type || 'CurrentAccount',
          identification_scheme: a.identification_scheme || 'BBAN',
          identification_value: a.identification_value,
          currency: a.currency || 'XAF',
          status: a.status || 'active',
          nickname: a.nickname
        }));

        const { data, error } = await supabase.from('bank_sourced_accounts').upsert(records, { onConflict: 'bank_id,external_account_id' }).select();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ingested: data?.length || 0, correlation_id });
      }

      case 'ingest_balances': {
        const { bank_id, balances, correlation_id } = body;
        if (!balances?.length) return errorResponse('Missing balances', 400);
        console.log(`[INGEST] balances count=${balances.length} corr=${correlation_id}`);

        const records = balances.map((b: any) => ({
          account_id: b.account_id,
          balance_type: b.balance_type || 'ClosingAvailable',
          amount: b.amount,
          currency: b.currency || 'XAF',
          as_of_datetime: b.as_of_datetime || new Date().toISOString()
        }));

        const { data, error } = await supabase.from('bank_sourced_balances').insert(records).select();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ingested: data?.length || 0, correlation_id });
      }

      case 'ingest_transactions': {
        const { bank_id, transactions, correlation_id } = body;
        if (!transactions?.length) return errorResponse('Missing transactions', 400);
        console.log(`[INGEST] transactions count=${transactions.length} corr=${correlation_id}`);

        const records = transactions.map((t: any) => ({
          account_id: t.account_id,
          external_tx_id: t.external_tx_id,
          booking_date: t.booking_date,
          value_date: t.value_date,
          amount: t.amount,
          currency: t.currency || 'XAF',
          credit_debit: t.credit_debit || 'Debit',
          reference: t.reference,
          description: t.description
        }));

        const { data, error } = await supabase.from('bank_sourced_transactions').upsert(records, { onConflict: 'account_id,external_tx_id' }).select();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ingested: data?.length || 0, correlation_id });
      }

      case 'ingest_beneficiaries': {
        const { bank_id, beneficiaries, correlation_id } = body;
        if (!beneficiaries?.length) return errorResponse('Missing beneficiaries', 400);

        const records = beneficiaries.map((b: any) => ({
          account_id: b.account_id,
          beneficiary_name: b.beneficiary_name,
          scheme_name: b.scheme_name || 'BBAN',
          identification: b.identification,
          bank_id_code: b.bank_id_code
        }));

        const { data, error } = await supabase.from('bank_sourced_beneficiaries').upsert(records, { onConflict: 'account_id,beneficiary_name,identification' }).select();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ingested: data?.length || 0, correlation_id });
      }

      // ─── Phase 3: PSU Linking ───
      case 'link_psu_start': {
        if (!user) return errorResponse('Auth required', 401);
        const { bank_id, external_customer_id } = body;
        if (!bank_id) return errorResponse('Missing bank_id', 400);

        // Find bank customer
        let customerQuery = supabase.from('bank_customers').select('id').eq('bank_id', bank_id);
        if (external_customer_id) customerQuery = customerQuery.eq('external_customer_id', external_customer_id);
        const { data: customer } = await customerQuery.single();

        const { data, error } = await supabase.from('bank_psu_links').upsert({
          user_id: user.id,
          bank_id,
          bank_customer_id: customer?.id || null,
          status: 'pending',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,bank_id' }).select().single();

        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }

      case 'link_psu_confirm': {
        if (!user) return errorResponse('Auth required', 401);
        const { bank_id } = body;
        if (!bank_id) return errorResponse('Missing bank_id', 400);

        const { data, error } = await supabase.from('bank_psu_links')
          .update({ status: 'active', linked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('bank_id', bank_id).eq('status', 'pending')
          .select().single();

        if (error) return errorResponse('No pending link found', 400);
        return jsonResponse(data);
      }

      case 'list_psu_links': {
        if (!user) return errorResponse('Auth required', 401);
        if (isAdmin) {
          const { data } = await supabase.from('bank_psu_links').select('*, banks(display_name, short_code)').order('created_at', { ascending: false }).limit(100);
          return jsonResponse({ links: data || [] });
        }
        const { data } = await supabase.from('bank_psu_links').select('*, banks(display_name, short_code)').eq('user_id', user.id);
        return jsonResponse({ links: data || [] });
      }

      // ─── Phase 4: Bank Payments ───
      case 'create_bank_payment': {
        if (!user) return errorResponse('Auth required', 401);
        const { bank_id, amount, currency, creditor_account_ref, creditor_name, debtor_account_ref, remittance_info, consent_id, idempotency_key } = body;
        if (!bank_id || !amount || !creditor_account_ref) return errorResponse('Missing required payment fields', 400);

        // Verify bank is active
        const { data: bank } = await supabase.from('banks').select('id, status').eq('id', bank_id).eq('status', 'active').single();
        if (!bank) return errorResponse('Bank not active or not found', 400);

        // Find active connector
        const { data: connector } = await supabase.from('bank_connector_instances').select('id').eq('bank_id', bank_id).eq('status', 'active').limit(1).single();

        const { data: payment, error } = await supabase.from('bank_payments').insert({
          bank_id, user_id: user.id, amount, currency: currency || 'XAF',
          creditor_account_ref, creditor_name, debtor_account_ref, remittance_info,
          consent_id, idempotency_key, connector_instance_id: connector?.id || null
        }).select().single();

        if (error) return errorResponse(error.message, 400);

        // Record initial event
        await supabase.from('bank_payment_status_events').insert({
          payment_id: payment.id, status_to: 'pending', source: 'engine',
          details_json: { created_by: user.id, bank_id }
        });

        return jsonResponse(payment, 201);
      }

      case 'payment_status_callback': {
        // Bank pushes status update
        const { bank_id, external_payment_id, status, error_code, error_message: errMsg } = body;
        if (!bank_id || !external_payment_id || !status) return errorResponse('Missing fields', 400);

        const validStatuses = ['accepted', 'completed', 'failed', 'reversed'];
        if (!validStatuses.includes(status)) return errorResponse('Invalid status', 400);

        const { data: payment } = await supabase.from('bank_payments')
          .select('id, status').eq('bank_id', bank_id).eq('external_payment_id', external_payment_id).single();
        if (!payment) return errorResponse('Payment not found', 404);

        const { data, error } = await supabase.from('bank_payments').update({
          status, error_code, error_message: errMsg, updated_at: new Date().toISOString()
        }).eq('id', payment.id).select().single();

        if (error) return errorResponse(error.message, 400);

        await supabase.from('bank_payment_status_events').insert({
          payment_id: payment.id, status_from: payment.status, status_to: status,
          source: 'connector', details_json: { bank_id, external_payment_id, error_code }
        });

        return jsonResponse(data);
      }

      case 'list_bank_payments': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id: bId, status: pStatus, limit: pLimit = 50, offset: pOffset = 0 } = body;
        let query = supabase.from('bank_payments').select('*, banks(display_name)', { count: 'exact' });
        if (bId) query = query.eq('bank_id', bId);
        if (pStatus) query = query.eq('status', pStatus);
        const { data, error, count } = await query.range(pOffset, pOffset + pLimit - 1).order('created_at', { ascending: false });
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ payments: data, total: count });
      }

      // ─── Phase 7: Sandbox Simulator ───
      case 'sandbox_seed_bank': {
        if (!isAdmin) return errorResponse('Admin only', 403);

        // Create sandbox bank
        const { data: bank, error: bankErr } = await supabase.from('banks').upsert({
          legal_name: 'Sandbox Bank Cameroon SA',
          display_name: 'Sandbox Bank CM',
          short_code: 'SBK-CM',
          swift_bic: 'SBKCMCMXXX',
          bank_code: '99999',
          status: 'active',
          integration_mode: 'connector_push',
          contact_email: 'sandbox@kob.cm',
          metadata: { sandbox: true }
        }, { onConflict: 'short_code' }).select().single();

        if (bankErr) return errorResponse(bankErr.message, 400);

        // Create branches
        await supabase.from('bank_branches').upsert([
          { bank_id: bank.id, name: 'Douala Main Branch', city: 'Douala', address: 'Rue de la Liberté, Akwa' },
          { bank_id: bank.id, name: 'Yaoundé Central Branch', city: 'Yaoundé', address: 'Avenue Kennedy, Centre' }
        ], { onConflict: 'id' });

        // Create sandbox connector
        const { data: connector } = await supabase.from('bank_connector_instances').upsert({
          bank_id: bank.id, name: 'Sandbox Connector', environment: 'sandbox',
          connector_type: 'rest', status: 'active'
        }, { onConflict: 'id' }).select().single();

        // Create sample customers
        const customers = [
          { bank_id: bank.id, external_customer_id: 'CUST-001', name: 'Jean Dupont', email: 'jean@example.cm', phone: '+237600000001' },
          { bank_id: bank.id, external_customer_id: 'CUST-002', name: 'Marie Ngo', email: 'marie@example.cm', phone: '+237600000002' },
          { bank_id: bank.id, external_customer_id: 'CUST-003', name: 'Paul Ekambi', email: 'paul@example.cm', phone: '+237600000003' }
        ];
        const { data: custData } = await supabase.from('bank_customers').upsert(customers, { onConflict: 'bank_id,external_customer_id' }).select();

        // Create sample accounts
        if (custData?.length) {
          const accts = custData.flatMap((c: any, i: number) => [
            { bank_id: bank.id, customer_id: c.id, external_account_id: `ACCT-${c.external_customer_id}-CHK`, account_type: 'CurrentAccount', identification_value: `CM21 10005 00${i}01 0000000${i}01 ${50 + i}`, currency: 'XAF', nickname: 'Compte Courant' },
            { bank_id: bank.id, customer_id: c.id, external_account_id: `ACCT-${c.external_customer_id}-SAV`, account_type: 'SavingsAccount', identification_value: `CM21 10005 00${i}01 0000000${i}02 ${60 + i}`, currency: 'XAF', nickname: 'Épargne' }
          ]);
          const { data: acctData } = await supabase.from('bank_sourced_accounts').upsert(accts, { onConflict: 'bank_id,external_account_id' }).select();

          // Balances + sample transactions
          if (acctData?.length) {
            const balances = acctData.map((a: any) => ({
              account_id: a.id, balance_type: 'ClosingAvailable',
              amount: a.account_type === 'CurrentAccount' ? 500000 + Math.floor(Math.random() * 1000000) : 250000 + Math.floor(Math.random() * 500000),
              currency: 'XAF'
            }));
            await supabase.from('bank_sourced_balances').insert(balances);

            const today = new Date();
            const txns: any[] = [];
            acctData.forEach((a: any) => {
              for (let d = 0; d < 10; d++) {
                const date = new Date(today); date.setDate(date.getDate() - d);
                const dateStr = date.toISOString().split('T')[0];
                txns.push({
                  account_id: a.id, external_tx_id: `TX-${a.external_account_id}-${d}`,
                  booking_date: dateStr, value_date: dateStr,
                  amount: 5000 + Math.floor(Math.random() * 50000), currency: 'XAF',
                  credit_debit: d % 3 === 0 ? 'Credit' : 'Debit',
                  reference: `REF-${dateStr}-${d}`, description: d % 3 === 0 ? 'Salary credit' : 'Purchase payment'
                });
              }
            });
            await supabase.from('bank_sourced_transactions').upsert(txns, { onConflict: 'account_id,external_tx_id' });
          }
        }

        // Health record
        if (connector) {
          await supabase.from('bank_connector_health').upsert({
            instance_id: connector.id, status: 'healthy', latency_ms: 45,
            details_json: { uptime: 99.9, last_ingestion: new Date().toISOString() }
          }, { onConflict: 'instance_id' });
        }

        return jsonResponse({ message: 'Sandbox bank seeded', bank_id: bank.id });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[bank-directory] Error:', error);
    return errorResponse('Internal server error', 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
