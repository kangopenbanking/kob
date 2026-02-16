import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { savings_account_id, amount, destination_account_id } = await req.json();

    console.log('Processing savings withdrawal:', { savings_account_id, amount });

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

    // Check if account is locked
    if (savingsAccount.is_locked) {
      const today = new Date();
      const maturityDate = new Date(savingsAccount.maturity_date);
      
      if (today < maturityDate) {
        const product = savingsAccount.savings_products;
        const penalty = (amount * (product.early_closure_penalty || 0)) / 100;
        
        return new Response(
          JSON.stringify({
            error: 'Account is locked until maturity',
            maturity_date: savingsAccount.maturity_date,
            early_closure_penalty: penalty,
            requires_confirmation: true,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check withdrawal limits
    const product = savingsAccount.savings_products;
    const currentMonth = new Date().getMonth();
    const lastWithdrawal = savingsAccount.last_withdrawal_date ? new Date(savingsAccount.last_withdrawal_date) : null;
    
    let withdrawalsThisMonth = savingsAccount.withdrawals_this_month || 0;
    if (lastWithdrawal && lastWithdrawal.getMonth() !== currentMonth) {
      withdrawalsThisMonth = 0;
    }

    if (product.max_withdrawals_per_month && withdrawalsThisMonth >= product.max_withdrawals_per_month) {
      throw new Error(`Maximum ${product.max_withdrawals_per_month} withdrawals per month exceeded`);
    }

    if (parseFloat(savingsAccount.available_balance) < amount) {
      throw new Error('Insufficient available balance');
    }

    const remainingBalance = parseFloat(savingsAccount.current_balance) - amount;
    if (product.min_balance && remainingBalance < product.min_balance && remainingBalance > 0) {
      throw new Error(`Minimum balance of ${product.min_balance} XAF must be maintained`);
    }

    // Update savings account balance
    const { error: updateError } = await supabase
      .from('savings_accounts')
      .update({
        current_balance: remainingBalance,
        available_balance: remainingBalance,
        withdrawals_this_month: withdrawalsThisMonth + 1,
        last_withdrawal_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', savings_account_id);

    if (updateError) {
      throw new Error('Failed to update savings balance');
    }

    const txRef = `WTH-${Date.now()}`;

    // Record transaction
    await supabase.from('savings_transactions').insert({
      savings_account_id,
      user_id: user.id,
      transaction_type: 'withdrawal',
      amount,
      balance_after: remainingBalance,
      destination_account_id,
      description: 'Withdrawal from savings',
      reference: txRef,
    });

    // Update account balance record
    await supabase.from('account_balances').upsert({
      account_id: savingsAccount.account_id,
      balance_type: 'InterimAvailable',
      credit_debit_indicator: 'Debit',
      amount: remainingBalance,
      currency: 'XAF',
      balance_datetime: new Date().toISOString(),
    });

    // ── Ledger integration: DR Customer Deposits, CR Cash ──
    try {
      const { data: ledgerAccounts } = await serviceSupabase
        .from('ledger_accounts')
        .select('id, account_code')
        .in('account_code', ['1000', '2000']);

      const cashAcct = ledgerAccounts?.find(a => a.account_code === '1000');
      const depositsAcct = ledgerAccounts?.find(a => a.account_code === '2000');

      if (cashAcct && depositsAcct) {
        const entryNumber = `SAV-WTH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const { data: journalEntry } = await serviceSupabase
          .from('journal_entries')
          .insert({
            entry_number: entryNumber,
            entry_date: new Date().toISOString().split('T')[0],
            description: `Savings withdrawal - ${amount} XAF`,
            reference_type: 'savings',
            reference_id: savings_account_id,
            is_reversed: false,
          })
          .select('id')
          .single();

        if (journalEntry) {
          await serviceSupabase.from('journal_lines').insert([
            { journal_entry_id: journalEntry.id, ledger_account_id: depositsAcct.id, debit: amount, credit: 0 },
            { journal_entry_id: journalEntry.id, ledger_account_id: cashAcct.id, debit: 0, credit: amount },
          ]);

          // Update ledger balances
          const { data: cashBal } = await serviceSupabase.from('ledger_accounts').select('balance').eq('id', cashAcct.id).single();
          const { data: depBal } = await serviceSupabase.from('ledger_accounts').select('balance').eq('id', depositsAcct.id).single();
          if (cashBal) await serviceSupabase.from('ledger_accounts').update({ balance: (cashBal.balance || 0) - amount }).eq('id', cashAcct.id);
          if (depBal) await serviceSupabase.from('ledger_accounts').update({ balance: (depBal.balance || 0) - amount }).eq('id', depositsAcct.id);
        }
      }
    } catch (ledgerErr) {
      console.error('Ledger posting failed (non-blocking):', ledgerErr);
    }

    console.log('Withdrawal successful. New balance:', remainingBalance);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: remainingBalance,
        withdrawals_remaining: (product.max_withdrawals_per_month || 999) - (withdrawalsThisMonth + 1),
        transaction_ref: txRef,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing withdrawal:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
