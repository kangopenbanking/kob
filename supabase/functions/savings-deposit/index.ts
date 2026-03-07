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
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { savings_account_id, amount, source_account_id } = await req.json();

    console.log('Processing savings deposit:', { savings_account_id, amount });

    // Get savings account
    const { data: savingsAccount, error: accountError } = await supabase
      .from('savings_accounts')
      .select('*, savings_products(*)')
      .eq('id', savings_account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !savingsAccount) {
      throw new Error('Savings account not found');
    }

    if (savingsAccount.status !== 'active') {
      throw new Error('Savings account is not active');
    }

    if (savingsAccount.is_locked) {
      throw new Error('Cannot deposit to locked fixed deposit account');
    }

    // Validate source account balance
    if (source_account_id) {
      const { data: sourceBalance } = await supabase
        .from('account_balances')
        .select('amount')
        .eq('account_id', source_account_id)
        .eq('balance_type', 'InterimAvailable')
        .single();

      if (!sourceBalance || parseFloat(sourceBalance.amount) < amount) {
        throw new Error('Insufficient balance in source account');
      }
    }

    // Update savings account balance
    const newBalance = parseFloat(savingsAccount.current_balance) + amount;
    const { error: updateError } = await supabase
      .from('savings_accounts')
      .update({
        current_balance: newBalance,
        available_balance: newBalance,
      })
      .eq('id', savings_account_id);

    if (updateError) {
      throw new Error('Failed to update savings balance');
    }

    const txRef = `DEP-${Date.now()}`;

    // Record transaction
    await supabase.from('savings_transactions').insert({
      savings_account_id,
      user_id: user.id,
      transaction_type: 'deposit',
      amount,
      balance_after: newBalance,
      source_account_id,
      description: 'Deposit to savings',
      reference: txRef,
    });

    // Update account balance record
    await supabase.from('account_balances').upsert({
      account_id: savingsAccount.account_id,
      balance_type: 'InterimAvailable',
      credit_debit_indicator: 'Credit',
      amount: newBalance,
      currency: 'XAF',
      balance_datetime: new Date().toISOString(),
    });

    // ── Ledger integration: DR Cash, CR Customer Deposits ──
    try {
      const { data: ledgerAccounts } = await serviceSupabase
        .from('ledger_accounts')
        .select('id, account_code')
        .in('account_code', ['1000', '2000']);

      const cashAcct = ledgerAccounts?.find(a => a.account_code === '1000');
      const depositsAcct = ledgerAccounts?.find(a => a.account_code === '2000');

      if (cashAcct && depositsAcct) {
        const entryNumber = `SAV-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const { data: journalEntry } = await serviceSupabase
          .from('journal_entries')
          .insert({
            entry_number: entryNumber,
            entry_date: new Date().toISOString().split('T')[0],
            description: `Savings deposit - ${amount} XAF`,
            reference_type: 'savings',
            reference_id: savings_account_id,
            is_reversed: false,
          })
          .select('id')
          .single();

        if (journalEntry) {
          await serviceSupabase.from('journal_lines').insert([
            { journal_entry_id: journalEntry.id, ledger_account_id: cashAcct.id, debit: amount, credit: 0 },
            { journal_entry_id: journalEntry.id, ledger_account_id: depositsAcct.id, debit: 0, credit: amount },
          ]);

          // Update ledger balances
          const { data: cashBal } = await serviceSupabase.from('ledger_accounts').select('balance').eq('id', cashAcct.id).single();
          const { data: depBal } = await serviceSupabase.from('ledger_accounts').select('balance').eq('id', depositsAcct.id).single();
          if (cashBal) await serviceSupabase.from('ledger_accounts').update({ balance: (cashBal.balance || 0) + amount }).eq('id', cashAcct.id);
          if (depBal) await serviceSupabase.from('ledger_accounts').update({ balance: (depBal.balance || 0) + amount }).eq('id', depositsAcct.id);
        }
      }
    } catch (ledgerErr) {
      console.error('Ledger posting failed (non-blocking):', ledgerErr);
    }

    // ── Credit event emission ──
    let creditScoreResult: any = null;
    try {
      await serviceSupabase.from('credit_events').insert({
        user_id: user.id,
        institution_id: savingsAccount.institution_id || null,
        event_type: 'SAVINGS_DEPOSIT',
        event_time: new Date().toISOString(),
        value_numeric: amount,
        metadata: {
          savings_account_id,
          balance_after: newBalance,
          transaction_ref: txRef,
        },
        source: 'savings_service',
      });

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const scoreRes = await fetch(`${supabaseUrl}/functions/v1/credit-score-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ user_id: user.id }),
      });
      creditScoreResult = await scoreRes.json();
    } catch (creditErr) {
      console.error('Credit event emission failed (non-blocking):', creditErr);
    }

    // Check if goal reached
    let goalReached = false;
    if (savingsAccount.target_amount && newBalance >= parseFloat(savingsAccount.target_amount)) {
      goalReached = true;
    }

    console.log('Deposit successful. New balance:', newBalance);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        goal_reached: goalReached,
        transaction_ref: txRef,
        ...(creditScoreResult ? {
          credit_score: {
            previous: creditScoreResult.previous_score,
            current: creditScoreResult.score,
            delta: creditScoreResult.delta,
          }
        } : {}),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing deposit:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
