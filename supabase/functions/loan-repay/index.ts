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
    // ── Auth: any authenticated user ──
    const roleResult = await validateUserRole(req);
    if (!roleResult.valid) {
      return errorResponse(corsHeaders, 401, 'unauthorized', roleResult.error);
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
      .eq('endpoint', 'loan-repay')
      .maybeSingle();

    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        return new Response(JSON.stringify({
          error: 'idempotency_conflict', error_code: 'LOAN_020',
          message: 'Idempotency key used with different payload',
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(existing.response_body), {
        status: existing.response_status || 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
      });
    }

    const body = JSON.parse(bodyText);
    const { loan_account_id, amount, payment_method, notes } = body;

    if (!loan_account_id || !amount || amount <= 0) {
      return errorResponse(corsHeaders, 400, 'LOAN_021', 'loan_account_id and positive amount are required');
    }

    // ── Fetch loan account (owner check) ──
    const { data: loan, error: loanErr } = await supabase
      .from('loan_accounts')
      .select('*')
      .eq('id', loan_account_id)
      .eq('user_id', roleResult.userId!)
      .single();

    if (loanErr || !loan) {
      return errorResponse(corsHeaders, 404, 'LOAN_022', 'Loan account not found');
    }

    if (!['active', 'disbursed'].includes(loan.status)) {
      return errorResponse(corsHeaders, 422, 'LOAN_023', `Cannot repay loan in status: ${loan.status}`);
    }

    if (amount > Number(loan.outstanding_balance)) {
      return errorResponse(corsHeaders, 422, 'LOAN_024', 'Payment exceeds outstanding balance');
    }

    // ── Allocate payment to pending schedules ──
    const { data: schedules } = await supabase
      .from('loan_schedule')
      .select('*')
      .eq('loan_id', loan_account_id)
      .in('status', ['pending', 'partial'])
      .order('installment_number', { ascending: true });

    let remainingAmount = amount;
    let totalPrincipal = 0;
    let totalInterest = 0;
    let totalFees = 0;

    for (const schedule of (schedules || [])) {
      if (remainingAmount <= 0) break;

      const outstanding = Number(schedule.total_amount) - Number(schedule.paid_amount);
      const paymentForSchedule = Math.min(remainingAmount, outstanding);

      // Allocate: fees first, then interest, then principal
      const feeRemaining = Number(schedule.fee_amount) - (Number(schedule.paid_amount) > Number(schedule.principal_amount) + Number(schedule.interest_amount) ? Number(schedule.paid_amount) - Number(schedule.principal_amount) - Number(schedule.interest_amount) : 0);
      const feePaid = Math.min(paymentForSchedule, Math.max(0, feeRemaining));
      const interestPaid = Math.min(paymentForSchedule - feePaid, Number(schedule.interest_amount));
      const principalPaid = paymentForSchedule - feePaid - interestPaid;

      totalFees += feePaid;
      totalInterest += interestPaid;
      totalPrincipal += principalPaid;

      const newPaid = Number(schedule.paid_amount) + paymentForSchedule;
      const isFullyPaid = newPaid >= Number(schedule.total_amount) - 0.01;

      await supabase
        .from('loan_schedule')
        .update({
          paid_amount: Math.round(newPaid * 100) / 100,
          status: isFullyPaid ? 'paid' : 'partial',
          paid_at: isFullyPaid ? new Date().toISOString() : null,
        })
        .eq('id', schedule.id);

      remainingAmount -= paymentForSchedule;
    }

    // ── Post to ledger: DR 1000 (Cash), CR 1200 (Loan Receivable) + CR 4100 (Interest Revenue) ──
    const cashId = await ensureLedgerAccount(supabase, '1000', 'Cash', 'asset');
    const loanReceivableId = await ensureLedgerAccount(supabase, '1200', 'Loan Receivable', 'asset');
    const interestRevenueId = await ensureLedgerAccount(supabase, '4100', 'Interest Revenue', 'revenue');

    const entryNumber = `JE-REPAY-${Date.now()}`;
    const { data: journalEntry, error: jeErr } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Loan repayment: ${loan.loan_account_number}`,
        reference_type: 'loan_repayment',
        reference_id: loan_account_id,
        is_reversed: false,
      })
      .select()
      .single();

    if (jeErr) throw jeErr;

    const journalLines: any[] = [
      { journal_entry_id: journalEntry.id, ledger_account_id: cashId, debit: amount, credit: 0 },
    ];

    if (totalPrincipal > 0) {
      journalLines.push({ journal_entry_id: journalEntry.id, ledger_account_id: loanReceivableId, debit: 0, credit: Math.round(totalPrincipal * 100) / 100 });
    }
    if (totalInterest + totalFees > 0) {
      journalLines.push({ journal_entry_id: journalEntry.id, ledger_account_id: interestRevenueId, debit: 0, credit: Math.round((totalInterest + totalFees) * 100) / 100 });
    }

    await supabase.from('journal_lines').insert(journalLines);

    // Update ledger balances
    await updateLedgerBalance(supabase, cashId, 'asset', amount, 0);
    if (totalPrincipal > 0) await updateLedgerBalance(supabase, loanReceivableId, 'asset', 0, totalPrincipal);
    if (totalInterest + totalFees > 0) await updateLedgerBalance(supabase, interestRevenueId, 'revenue', 0, totalInterest + totalFees);

    // ── Record repayment ──
    const paymentRef = `LP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await supabase.from('loan_repayments').insert({
      loan_id: loan_account_id,
      amount,
      principal_paid: Math.round(totalPrincipal * 100) / 100,
      interest_paid: Math.round(totalInterest * 100) / 100,
      fees_paid: Math.round(totalFees * 100) / 100,
      payment_method: payment_method || 'bank_transfer',
      payment_reference: paymentRef,
      journal_entry_id: journalEntry.id,
    });

    // ── Update loan account ──
    const newRepaid = Number(loan.amount_repaid) + amount;
    const newOutstanding = Number(loan.outstanding_balance) - amount;
    const isCompleted = newOutstanding <= 0.01;

    // Find next pending schedule
    const { data: nextSched } = await supabase
      .from('loan_schedule')
      .select('due_date, total_amount, paid_amount')
      .eq('loan_id', loan_account_id)
      .eq('status', 'pending')
      .order('installment_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    await supabase
      .from('loan_accounts')
      .update({
        amount_repaid: Math.round(newRepaid * 100) / 100,
        outstanding_balance: Math.max(0, Math.round(newOutstanding * 100) / 100),
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? new Date().toISOString() : null,
        next_payment_date: nextSched?.due_date || null,
        next_payment_amount: nextSched ? Number(nextSched.total_amount) - Number(nextSched.paid_amount) : null,
      })
      .eq('id', loan_account_id);

    // ── Record event ──
    await supabase.from('loan_events').insert({
      loan_id: loan_account_id,
      event_type: 'repayment',
      performed_by: roleResult.userId!,
      metadata: {
        amount, principal_paid: totalPrincipal, interest_paid: totalInterest, fees_paid: totalFees,
        payment_reference: paymentRef, journal_entry_id: journalEntry.id, notes,
      },
    });

    if (isCompleted) {
      await supabase.from('loan_events').insert({
        loan_id: loan_account_id,
        event_type: 'completed',
        performed_by: roleResult.userId!,
        metadata: { total_repaid: newRepaid },
      });
    }

    const responseBody = {
      data: {
        payment_reference: paymentRef,
        amount,
        principal_paid: Math.round(totalPrincipal * 100) / 100,
        interest_paid: Math.round(totalInterest * 100) / 100,
        fees_paid: Math.round(totalFees * 100) / 100,
        remaining_balance: Math.max(0, Math.round(newOutstanding * 100) / 100),
        loan_status: isCompleted ? 'completed' : 'active',
        journal_entry_id: journalEntry.id,
      },
    };

    // Cache idempotency
    await supabase.from('idempotency_keys').insert({
      idempotency_key: idempotencyKey,
      client_id: roleResult.userId!,
      endpoint: 'loan-repay',
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
    console.error('loan-repay error:', err);
    return errorResponse(corsHeaders, 500, 'LOAN_999', 'Internal server error');
  }
});

async function ensureLedgerAccount(supabase: any, code: string, name: string, type: string): Promise<string> {
  const { data } = await supabase.from('ledger_accounts').select('id').eq('account_code', code).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await supabase.from('ledger_accounts')
    .insert({ account_code: code, account_name: name, account_type: type, currency: 'XAF', balance: 0 })
    .select().single();
  if (error) throw error;
  return created.id;
}

async function updateLedgerBalance(supabase: any, accountId: string, accountType: string, debit: number, credit: number) {
  const { data: account } = await supabase.from('ledger_accounts').select('balance').eq('id', accountId).single();
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
