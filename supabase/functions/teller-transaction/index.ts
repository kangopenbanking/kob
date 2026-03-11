import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { account_id, amount, operation, description, institution_id } = await req.json();

    if (!account_id || !amount || !operation || !institution_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: account_id, amount, operation, institution_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['deposit', 'withdraw'].includes(operation)) {
      return new Response(JSON.stringify({ error: 'Operation must be "deposit" or "withdraw"' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be positive' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the teller belongs to this institution (owner or staff)
    const { data: institution } = await supabase
      .from('institutions')
      .select('id')
      .eq('id', institution_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: staffAssignment } = await serviceSupabase
      .from('staff_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!institution && !staffAssignment) {
      return new Response(JSON.stringify({ error: 'Not authorized for this institution' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the account and verify it belongs to this institution
    const { data: account, error: accountError } = await serviceSupabase
      .from('accounts')
      .select('*')
      .eq('id', account_id)
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Account not found or inactive' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get current balance
    const { data: currentBalance } = await serviceSupabase
      .from('account_balances')
      .select('*')
      .eq('account_id', account_id)
      .in('balance_type', ['InterimAvailable', 'ClosingAvailable'])
      .order('balance_datetime', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentAmount = currentBalance ? Number(currentBalance.amount) : 0;

    // ═══ WITHDRAWAL POLICY CHECK (non-breaking enhancement) ═══
    if (operation === 'withdraw') {
      try {
        const { data: policyResult } = await serviceSupabase.rpc('evaluate_withdrawal_policy', {
          _institution_id: institution_id,
          _branch_id: null,
          _staff_user_id: user.id,
          _amount: amount,
          _currency: account.currency || 'XAF',
          _channel: 'branch',
        });

        if (policyResult && policyResult.allowed === false) {
          // Create withdrawal request + approval workflow instead of rejecting
          const { data: wr } = await serviceSupabase.from('withdrawal_requests').insert({
            institution_id, account_id, initiated_by_staff_id: user.id,
            amount, currency: account.currency || 'XAF', channel: 'branch',
            source_type: 'teller', source_endpoint: 'teller-transaction',
            current_status: policyResult.escalation_target === 'assistant_manager' ? 'pending_assistant_manager' : policyResult.escalation_target === 'general_manager' ? 'pending_general_manager' : 'pending_branch_manager',
            policy_result: policyResult, required_role: policyResult.escalation_target || 'branch_manager',
            reason: `Teller withdrawal exceeds ${policyResult.reason}: ${amount} ${account.currency}`,
          }).select().single();

          if (wr) {
            const approvalStatus = wr.current_status;
            const { data: ar } = await serviceSupabase.from('approval_requests').insert({
              institution_id, entity_type: 'withdrawal_request', entity_id: wr.id,
              request_type: 'withdrawal_override', current_stage: approvalStatus,
              required_role: policyResult.escalation_target || 'branch_manager',
              submitted_by: user.id, status: approvalStatus,
              reason: wr.reason,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            }).select().single();

            if (ar) {
              await serviceSupabase.from('withdrawal_requests').update({ approval_request_id: ar.id }).eq('id', wr.id);
              await serviceSupabase.from('approval_actions').insert({
                approval_request_id: ar.id, action: 'submit', acted_by: user.id,
                acted_role: policyResult.staff_role, comments: wr.reason,
                metadata: { amount, policy_result: policyResult },
              });
            }
          }

          return new Response(JSON.stringify({
            requires_approval: true,
            withdrawal_request_id: wr?.id,
            approval_status: wr?.current_status,
            policy_evaluation: policyResult,
            message: `Withdrawal of ${amount} ${account.currency} requires ${policyResult.escalation_target || 'manager'} approval`,
          }), { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (policyErr) {
        // Policy evaluation failure is non-blocking — fall through to existing behavior
        console.error('Policy evaluation failed (non-blocking):', policyErr);
      }
    }

    // For withdrawals, check sufficient funds
    if (operation === 'withdraw' && currentAmount < amount) {
      return new Response(JSON.stringify({
        error: 'Insufficient funds',
        current_balance: currentAmount,
        requested: amount,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const newBalance = operation === 'deposit'
      ? currentAmount + amount
      : currentAmount - amount;

    const now = new Date().toISOString();
    const txRef = `TLR-${operation.toUpperCase().slice(0, 3)}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const creditDebit = operation === 'deposit' ? 'Credit' : 'Debit';
    const txDescription = description || `Teller ${operation} — ${amount} ${account.currency}`;

    // 1. Update balance
    if (currentBalance) {
      const { error: balErr } = await serviceSupabase
        .from('account_balances')
        .update({ amount: newBalance, balance_datetime: now })
        .eq('id', currentBalance.id);
      if (balErr) throw new Error('Failed to update balance: ' + balErr.message);
    } else {
      const { error: balErr } = await serviceSupabase
        .from('account_balances')
        .insert({
          account_id,
          balance_type: 'InterimAvailable',
          credit_debit_indicator: creditDebit,
          amount: newBalance,
          currency: account.currency,
          balance_datetime: now,
        });
      if (balErr) throw new Error('Failed to create balance: ' + balErr.message);
    }

    // 2. Create transaction record (include user_id so account owner sees it in their app)
    const { error: txErr } = await serviceSupabase
      .from('transactions')
      .insert({
        account_id,
        institution_id,
        user_id: account.user_id,
        amount,
        currency: account.currency,
        credit_debit_indicator: creditDebit,
        status: 'Booked',
        booking_datetime: now,
        value_datetime: now,
        transaction_information: txDescription,
        transaction_type: `teller_${operation}`,
        merchant_details: {
          transaction_ref: txRef,
          merchant_category_code: 'TELLER',
          teller_user_id: user.id,
          operation,
          balance_before: currentAmount,
          balance_after: newBalance,
        },
      });

    if (txErr) {
      // Rollback balance
      if (currentBalance) {
        await serviceSupabase.from('account_balances').update({ amount: currentAmount, balance_datetime: now }).eq('id', currentBalance.id);
      }
      throw new Error('Failed to create transaction: ' + txErr.message);
    }

    // 3. Ledger posting (non-blocking)
    try {
      const { data: ledgerAccounts } = await serviceSupabase
        .from('ledger_accounts')
        .select('id, account_code')
        .in('account_code', ['1000', '2000']);

      const cashAcct = ledgerAccounts?.find(a => a.account_code === '1000');
      const depositsAcct = ledgerAccounts?.find(a => a.account_code === '2000');

      if (cashAcct && depositsAcct) {
        const entryNumber = `TLR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const { data: journalEntry } = await serviceSupabase
          .from('journal_entries')
          .insert({
            entry_number: entryNumber,
            entry_date: now.split('T')[0],
            description: txDescription,
            reference_type: 'teller',
            reference_id: account_id,
            is_reversed: false,
          })
          .select('id')
          .single();

        if (journalEntry) {
          if (operation === 'deposit') {
            // DR Cash, CR Customer Deposits
            await serviceSupabase.from('journal_lines').insert([
              { journal_entry_id: journalEntry.id, ledger_account_id: cashAcct.id, debit: amount, credit: 0 },
              { journal_entry_id: journalEntry.id, ledger_account_id: depositsAcct.id, debit: 0, credit: amount },
            ]);
          } else {
            // DR Customer Deposits, CR Cash
            await serviceSupabase.from('journal_lines').insert([
              { journal_entry_id: journalEntry.id, ledger_account_id: depositsAcct.id, debit: amount, credit: 0 },
              { journal_entry_id: journalEntry.id, ledger_account_id: cashAcct.id, debit: 0, credit: amount },
            ]);
          }
        }
      }
    } catch (ledgerErr) {
      console.error('Ledger posting failed (non-blocking):', ledgerErr);
    }

    console.log(`Teller ${operation} completed:`, { account_id, amount, newBalance, teller: user.id });

    return new Response(JSON.stringify({
      success: true,
      operation,
      amount,
      currency: account.currency,
      balance_before: currentAmount,
      balance_after: newBalance,
      transaction_ref: txRef,
      account_holder: account.account_holder_name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Teller transaction error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
