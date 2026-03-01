import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { source_account_id, destination_account_id, amount, currency, reference, description, institution_id } = await req.json();

    // Validate required fields
    if (!source_account_id || !destination_account_id || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields: source_account_id, destination_account_id, amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be a positive number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (source_account_id === destination_account_id) {
      return new Response(JSON.stringify({ error: 'Cannot transfer to the same account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const txCurrency = currency || 'XAF';

    // Verify source account belongs to user
    const { data: sourceAccount, error: sourceError } = await supabase
      .from('accounts')
      .select('id, account_holder_name, user_id, institution_id')
      .eq('id', source_account_id)
      .eq('user_id', user.id)
      .single();

    if (sourceError || !sourceAccount) {
      return new Response(JSON.stringify({ error: 'Source account not found or unauthorized' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check source account balance — try InterimAvailable first, then ClosingAvailable
    let sourceBalance = null;
    const { data: interimBal } = await supabase
      .from('account_balances')
      .select('id, amount, balance_type')
      .eq('account_id', source_account_id)
      .eq('balance_type', 'InterimAvailable')
      .single();

    if (interimBal) {
      sourceBalance = interimBal;
    } else {
      const { data: closingBal } = await supabase
        .from('account_balances')
        .select('id, amount, balance_type')
        .eq('account_id', source_account_id)
        .eq('balance_type', 'ClosingAvailable')
        .single();
      sourceBalance = closingBal;
    }

    if (!sourceBalance || parseFloat(sourceBalance.amount) < transferAmount) {
      return new Response(JSON.stringify({ error: 'Insufficient funds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify destination account exists — support UUID, account_id, or identification_value lookup
    let destAccount: any = null;

    // Try by UUID first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(destination_account_id)) {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id')
        .eq('id', destination_account_id)
        .eq('is_active', true)
        .single();
      destAccount = data;
    }

    // Fallback: try by human-readable account_id (e.g. ACC-...)
    if (!destAccount) {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id')
        .eq('account_id', destination_account_id)
        .eq('is_active', true)
        .maybeSingle();
      destAccount = data;
    }

    // Fallback: try by identification_value (phone number, national ID, etc.)
    if (!destAccount) {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id')
        .eq('identification_value', destination_account_id)
        .eq('is_active', true)
        .maybeSingle();
      destAccount = data;
    }

    if (!destAccount) {
      return new Response(JSON.stringify({ error: 'Destination account not found. Try an account number, ID, or phone number.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate transaction reference
    const transactionRef = reference || `TXN-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    // ══════════════════════════════════════════════
    // STEP 1: Debit source account balance
    // ══════════════════════════════════════════════
    const newSourceAmount = parseFloat(sourceBalance.amount) - transferAmount;

    const { error: debitBalErr } = await supabase
      .from('account_balances')
      .update({
        amount: newSourceAmount,
        balance_datetime: now,
      })
      .eq('id', sourceBalance.id);

    if (debitBalErr) {
      console.error('Failed to debit source balance:', debitBalErr);
      return new Response(JSON.stringify({ error: 'Failed to process transfer' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ══════════════════════════════════════════════
    // STEP 2: Credit destination account balance
    // ══════════════════════════════════════════════
    // Try InterimAvailable first, then ClosingAvailable
    let destBalance = null;
    const { data: destInterimBal } = await supabase
      .from('account_balances')
      .select('id, amount, balance_type')
      .eq('account_id', destAccount.id)
      .eq('balance_type', 'InterimAvailable')
      .single();

    if (destInterimBal) {
      destBalance = destInterimBal;
    } else {
      const { data: destClosingBal } = await supabase
        .from('account_balances')
        .select('id, amount, balance_type')
        .eq('account_id', destAccount.id)
        .eq('balance_type', 'ClosingAvailable')
        .single();
      destBalance = destClosingBal;
    }

    if (destBalance) {
      const newDestAmount = parseFloat(destBalance.amount) + transferAmount;
      const { error: creditBalErr } = await supabase
        .from('account_balances')
        .update({
          amount: newDestAmount,
          balance_datetime: now,
        })
        .eq('id', destBalance.id);

      if (creditBalErr) {
        // Rollback source debit
        await supabase.from('account_balances')
          .update({ amount: parseFloat(sourceBalance.amount), balance_datetime: now })
          .eq('id', sourceBalance.id);
        console.error('Failed to credit destination balance:', creditBalErr);
        return new Response(JSON.stringify({ error: 'Failed to process transfer' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Create a new balance record for destination
      const { error: insertBalErr } = await supabase
        .from('account_balances')
        .insert({
          account_id: destAccount.id,
          balance_type: 'ClosingAvailable',
          credit_debit_indicator: 'Credit',
          amount: transferAmount,
          currency: txCurrency,
          balance_datetime: now,
        });

    if (insertBalErr) {
        // Rollback source debit
        await supabase.from('account_balances')
          .update({ amount: parseFloat(sourceBalance.amount), balance_datetime: now })
          .eq('id', sourceBalance.id);
        console.error('Failed to create destination balance:', insertBalErr);
        return new Response(JSON.stringify({ error: 'Failed to process transfer' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Use resolved destination account ID for all subsequent operations
    const resolvedDestId = destAccount.id;

    // ══════════════════════════════════════════════
    // STEP 3: Create debit transaction for sender
    // ══════════════════════════════════════════════
    const txDescription = description || `Transfer to ${destAccount.account_holder_name}`;

    const { data: debitTxn, error: debitTxnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: source_account_id,
        institution_id: sourceAccount.institution_id,
        transaction_id: transactionRef,
        credit_debit_indicator: 'Debit',
        status: 'Booked',
        booking_date: now,
        value_date: now,
        transaction_type: 'Transfer',
        amount: transferAmount,
        currency: txCurrency,
        transaction_information: txDescription,
        merchant_details: {
          destination_account_id: destAccount.id,
          destination_account_holder: destAccount.account_holder_name,
          transfer_type: sourceAccount.institution_id === destAccount.institution_id ? 'internal' : 'interbank',
        },
      })
      .select('id')
      .single();

    if (debitTxnErr) {
      console.error('Failed to create debit transaction:', debitTxnErr);
    }

    // ══════════════════════════════════════════════
    // STEP 4: Create credit transaction for receiver
    // ══════════════════════════════════════════════
    const creditDescription = description || `Received from ${sourceAccount.account_holder_name}`;

    const { error: creditTxnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: destAccount.user_id,
        account_id: destAccount.id,
        institution_id: destAccount.institution_id,
        transaction_id: `${transactionRef}-CR`,
        credit_debit_indicator: 'Credit',
        status: 'Booked',
        booking_date: now,
        value_date: now,
        transaction_type: 'Transfer',
        amount: transferAmount,
        currency: txCurrency,
        transaction_information: creditDescription,
        merchant_details: {
          source_account_id,
          source_account_holder: sourceAccount.account_holder_name,
          transfer_type: sourceAccount.institution_id === destAccount.institution_id ? 'internal' : 'interbank',
        },
      });

    if (creditTxnErr) {
      console.error('Failed to create credit transaction:', creditTxnErr);
    }

    // ══════════════════════════════════════════════
    // STEP 5: Ledger integration (non-blocking)
    // ══════════════════════════════════════════════
    try {
      const { data: ledgerAccounts } = await supabase
        .from('ledger_accounts')
        .select('id, account_code')
        .in('account_code', ['1000', '2000']);

      const cashAcct = ledgerAccounts?.find(a => a.account_code === '1000');
      const depositsAcct = ledgerAccounts?.find(a => a.account_code === '2000');

      if (cashAcct && depositsAcct) {
        const entryNumber = `TFR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const { data: journalEntry } = await supabase
          .from('journal_entries')
          .insert({
            entry_number: entryNumber,
            entry_date: now.split('T')[0],
            description: `Internal transfer - ${transferAmount} ${txCurrency}`,
            reference_type: 'transfer',
            reference_id: debitTxn?.id || source_account_id,
            is_reversed: false,
          })
          .select('id')
          .single();

        if (journalEntry) {
          await supabase.from('journal_lines').insert([
            { journal_entry_id: journalEntry.id, ledger_account_id: cashAcct.id, debit: transferAmount, credit: 0 },
            { journal_entry_id: journalEntry.id, ledger_account_id: depositsAcct.id, debit: 0, credit: transferAmount },
          ]);
        }
      }
    } catch (ledgerErr) {
      console.error('Ledger posting failed (non-blocking):', ledgerErr);
    }

    // ══════════════════════════════════════════════
    // STEP 6: Record transaction fee (non-blocking)
    // ══════════════════════════════════════════════
    try {
      const instId = institution_id || sourceAccount.institution_id;
      if (instId) {
        await supabase.rpc('record_transaction_fee', {
          _institution_id: instId,
          _transaction_type: 'internal_transfer',
          _transaction_ref: transactionRef,
          _transaction_amount: transferAmount,
          _transaction_id: debitTxn?.id || null,
          _metadata: {
            source_account_id,
            destination_account_id: destAccount.id,
            currency: txCurrency,
          },
        });
      }
    } catch (feeErr) {
      console.error('Fee recording failed (non-blocking):', feeErr);
    }

    console.log(`Transfer ${transactionRef} completed: ${transferAmount} ${txCurrency} from ${source_account_id} to ${destAccount.id}`);

    return new Response(JSON.stringify({
      success: true,
      transaction_reference: transactionRef,
      transaction_id: debitTxn?.id,
      status: 'Booked',
      amount: transferAmount,
      currency: txCurrency,
      sender: sourceAccount.account_holder_name,
      receiver: destAccount.account_holder_name,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Transfer error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
