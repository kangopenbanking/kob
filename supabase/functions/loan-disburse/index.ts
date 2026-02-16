import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateUserRole, errorResponse } from "../_shared/role-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(corsHeaders, 405, 'method_not_allowed', 'Use POST');
  }

  try {
    const roleResult = await validateUserRole(req, ['admin']);
    if (!roleResult.valid) {
      return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
        roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden',
        roleResult.error);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Idempotency ──
    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return errorResponse(corsHeaders, 400, 'missing_idempotency_key', 'Idempotency-Key header is required');
    }

    const bodyText = await req.text();
    const payloadHash = await hashPayload(bodyText);

    const { data: existing } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('client_id', roleResult.userId!)
      .eq('endpoint', 'loan-disburse')
      .maybeSingle();

    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        return new Response(JSON.stringify({
          error: 'idempotency_conflict', error_code: 'LOAN_010',
          message: 'Idempotency key used with different payload',
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(existing.response_body), {
        status: existing.response_status || 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
      });
    }

    const body = JSON.parse(bodyText);
    const { loan_account_id, disbursement_method, notes } = body;

    if (!loan_account_id) {
      return errorResponse(corsHeaders, 400, 'LOAN_011', 'loan_account_id is required');
    }

    // ── Fetch loan account ──
    const { data: loan, error: loanErr } = await supabase
      .from('loan_accounts')
      .select('*')
      .eq('id', loan_account_id)
      .single();

    if (loanErr || !loan) {
      return errorResponse(corsHeaders, 404, 'LOAN_012', 'Loan account not found');
    }

    if (loan.status !== 'approved') {
      return errorResponse(corsHeaders, 422, 'LOAN_013', `Cannot disburse loan in status: ${loan.status}`);
    }

    // ── Post to ledger: DR 1200 (Loan Receivable), CR 1000 (Cash) ──
    // Find or create ledger accounts
    const loanReceivableId = await ensureLedgerAccount(supabase, '1200', 'Loan Receivable', 'asset');
    const cashAccountId = await ensureLedgerAccount(supabase, '1000', 'Cash', 'asset');

    const entryNumber = `JE-DISBURSE-${Date.now()}`;
    const { data: journalEntry, error: jeErr } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Loan disbursement: ${loan.loan_account_number}`,
        reference_type: 'loan_disbursement',
        reference_id: loan_account_id,
        is_reversed: false,
      })
      .select()
      .single();

    if (jeErr) throw jeErr;

    // Insert journal lines
    await supabase.from('journal_lines').insert([
      { journal_entry_id: journalEntry.id, ledger_account_id: loanReceivableId, debit: Number(loan.principal_amount), credit: 0 },
      { journal_entry_id: journalEntry.id, ledger_account_id: cashAccountId, debit: 0, credit: Number(loan.principal_amount) },
    ]);

    // Update ledger balances
    await updateLedgerBalance(supabase, loanReceivableId, 'asset', Number(loan.principal_amount), 0);
    await updateLedgerBalance(supabase, cashAccountId, 'asset', 0, Number(loan.principal_amount));

    // ── Update loan account ──
    const now = new Date().toISOString();
    await supabase
      .from('loan_accounts')
      .update({
        status: 'disbursed',
        amount_disbursed: loan.principal_amount,
        disbursed_at: now,
      })
      .eq('id', loan_account_id);

    // ── Record event ──
    await supabase.from('loan_events').insert({
      loan_id: loan_account_id,
      event_type: 'disbursed',
      performed_by: roleResult.userId!,
      metadata: {
        amount: Number(loan.principal_amount),
        journal_entry_id: journalEntry.id,
        disbursement_method: disbursement_method || 'bank_transfer',
        notes,
      },
    });

    const responseBody = {
      data: {
        loan_account_id,
        status: 'disbursed',
        amount_disbursed: Number(loan.principal_amount),
        journal_entry_id: journalEntry.id,
        disbursed_at: now,
      },
    };

    // Cache idempotency
    await supabase.from('idempotency_keys').insert({
      idempotency_key: idempotencyKey,
      client_id: roleResult.userId!,
      endpoint: 'loan-disburse',
      payload_hash: payloadHash,
      response_status: 200,
      response_body: responseBody,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    });
  } catch (err) {
    console.error('loan-disburse error:', err);
    return errorResponse(corsHeaders, 500, 'LOAN_999', 'Internal server error');
  }
});

async function ensureLedgerAccount(supabase: any, code: string, name: string, type: string): Promise<string> {
  const { data } = await supabase
    .from('ledger_accounts')
    .select('id')
    .eq('account_code', code)
    .maybeSingle();

  if (data) return data.id;

  const { data: created, error } = await supabase
    .from('ledger_accounts')
    .insert({ account_code: code, account_name: name, account_type: type, currency: 'XAF', balance: 0 })
    .select()
    .single();

  if (error) throw error;
  return created.id;
}

async function updateLedgerBalance(supabase: any, accountId: string, accountType: string, debit: number, credit: number) {
  const { data: account } = await supabase
    .from('ledger_accounts')
    .select('balance')
    .eq('id', accountId)
    .single();

  if (!account) return;

  let newBalance: number;
  if (['asset', 'expense'].includes(accountType)) {
    newBalance = (account.balance || 0) + debit - credit;
  } else {
    newBalance = (account.balance || 0) + credit - debit;
  }

  await supabase.from('ledger_accounts').update({ balance: newBalance }).eq('id', accountId);
}

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
