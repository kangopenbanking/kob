import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * savings-accrue-interest
 * 
 * Cron-compatible edge function that calculates and posts daily interest
 * for all active savings accounts. Creates interest_accruals records and
 * posts corresponding journal entries to the ledger.
 * 
 * Can be triggered by:
 * - Supabase cron (pg_cron)
 * - Manual admin invocation
 * 
 * POST body (optional):
 *   { "accrual_date": "2026-02-16" }  — defaults to today
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional accrual date
    let accrualDate: string;
    try {
      const body = await req.json();
      accrualDate = body.accrual_date || new Date().toISOString().split('T')[0];
    } catch {
      accrualDate = new Date().toISOString().split('T')[0];
    }

    console.log(`[interest-accrual] Starting accrual for date: ${accrualDate}`);

    // Get all active savings accounts with their product interest rates
    const { data: accounts, error: accErr } = await supabase
      .from('savings_accounts')
      .select('id, current_balance, current_interest_rate, interest_accrued, total_interest_earned, last_interest_date, product_id, user_id, savings_products(base_interest_rate, interest_payment_frequency)')
      .eq('status', 'active')
      .gt('current_balance', 0);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      console.log('[interest-accrual] No active accounts with balance > 0');
      return new Response(JSON.stringify({ processed: 0, total_interest: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get ledger accounts for interest posting
    const { data: ledgerAccounts } = await supabase
      .from('ledger_accounts')
      .select('id, account_code')
      .in('account_code', ['5000', '2100']);

    const interestExpenseAcct = ledgerAccounts?.find(a => a.account_code === '5000');
    const interestPayableAcct = ledgerAccounts?.find(a => a.account_code === '2100');

    let processedCount = 0;
    let totalInterest = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        // Skip if already accrued for this date
        const { data: existingAccrual } = await supabase
          .from('interest_accruals')
          .select('id')
          .eq('savings_account_id', account.id)
          .eq('accrual_date', accrualDate)
          .maybeSingle();

        if (existingAccrual) {
          console.log(`[interest-accrual] Already accrued for account ${account.id} on ${accrualDate}`);
          continue;
        }

        // Calculate daily interest: annual_rate / 365 * balance
        const annualRate = account.current_interest_rate || 
          (account.savings_products as any)?.base_interest_rate || 0;
        
        if (annualRate <= 0) continue;

        const dailyRate = annualRate / 100 / 365;
        const balance = Number(account.current_balance);
        const accruedAmount = Math.round(balance * dailyRate); // XAF has no decimals

        if (accruedAmount <= 0) continue;

        const balanceAfter = balance + accruedAmount;

        // Post journal entry if ledger accounts exist
        let journalEntryId: string | null = null;
        if (interestExpenseAcct && interestPayableAcct) {
          const entryNumber = `INT-${accrualDate}-${account.id.substring(0, 8)}`;

          const { data: journalEntry, error: jeErr } = await supabase
            .from('journal_entries')
            .insert({
              entry_number: entryNumber,
              entry_date: accrualDate,
              description: `Daily interest accrual - ${accruedAmount} XAF @ ${annualRate}% p.a.`,
              reference_type: 'savings',
              reference_id: account.id,
              is_reversed: false,
            })
            .select('id')
            .single();

          if (!jeErr && journalEntry) {
            journalEntryId = journalEntry.id;

            // DR Interest Expense, CR Interest Payable
            await supabase.from('journal_lines').insert([
              { journal_entry_id: journalEntry.id, ledger_account_id: interestExpenseAcct.id, debit: accruedAmount, credit: 0 },
              { journal_entry_id: journalEntry.id, ledger_account_id: interestPayableAcct.id, debit: 0, credit: accruedAmount },
            ]);

            // Update ledger balances
            await supabase.rpc('', {}).catch(() => {}); // no-op, update manually
            const { data: expAcct } = await supabase.from('ledger_accounts').select('balance').eq('id', interestExpenseAcct.id).single();
            const { data: payAcct } = await supabase.from('ledger_accounts').select('balance').eq('id', interestPayableAcct.id).single();
            
            if (expAcct) {
              await supabase.from('ledger_accounts').update({ balance: (expAcct.balance || 0) + accruedAmount }).eq('id', interestExpenseAcct.id);
            }
            if (payAcct) {
              await supabase.from('ledger_accounts').update({ balance: (payAcct.balance || 0) + accruedAmount }).eq('id', interestPayableAcct.id);
            }
          }
        }

        // Record interest accrual
        await supabase.from('interest_accruals').insert({
          savings_account_id: account.id,
          accrual_date: accrualDate,
          interest_rate: annualRate,
          accrued_amount: accruedAmount,
          balance_before: balance,
          balance_after: balanceAfter,
          journal_entry_id: journalEntryId,
        });

        // Update savings account
        await supabase.from('savings_accounts').update({
          interest_accrued: (Number(account.interest_accrued) || 0) + accruedAmount,
          total_interest_earned: (Number(account.total_interest_earned) || 0) + accruedAmount,
          last_interest_date: accrualDate,
        }).eq('id', account.id);

        processedCount++;
        totalInterest += accruedAmount;
      } catch (err) {
        console.error(`[interest-accrual] Error for account ${account.id}:`, err);
        errors.push(`${account.id}: ${(err as Error).message}`);
      }
    }

    console.log(`[interest-accrual] Complete. Processed: ${processedCount}, Total interest: ${totalInterest} XAF`);

    return new Response(JSON.stringify({
      processed: processedCount,
      total_interest: totalInterest,
      accrual_date: accrualDate,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[interest-accrual] Fatal error:', err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      error_code: 'SAV_999',
      message: 'Interest accrual failed',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
