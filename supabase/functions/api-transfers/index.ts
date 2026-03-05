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

    const body = await req.json();
    const { source_account_id, destination_account_id, amount, currency, reference, description, institution_id, identifier_type } = body;

    console.log('Transfer request:', { source_account_id, destination_account_id, amount, currency, identifier_type });

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

    // Verify destination account exists — support UUID, account_id, identification_value, or DOMESTIC_RIB lookup
    let destAccount: any = null;
    let transferRail = 'internal'; // default rail

    // Try by UUID first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(destination_account_id)) {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id, identification_scheme')
        .eq('id', destination_account_id)
        .eq('is_active', true)
        .single();
      destAccount = data;
    }

    // Fallback: try by human-readable account_id (e.g. ACC-...)
    if (!destAccount) {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id, identification_scheme')
        .eq('account_id', destination_account_id)
        .eq('is_active', true)
        .maybeSingle();
      destAccount = data;
    }

    // Fallback: try by identification_value (phone number, national ID, etc.)
    if (!destAccount) {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id, identification_scheme')
        .eq('identification_value', destination_account_id)
        .eq('is_active', true)
        .maybeSingle();
      destAccount = data;
    }

    // Tier 3b: Try phone number lookup via profiles table
    if (!destAccount) {
      // Normalize phone: strip spaces, dashes; ensure starts with + or digits
      const cleanPhone = destination_account_id.replace(/[\s\-\(\)]/g, '');
      // Try multiple phone formats
      const phoneVariants = [cleanPhone];
      // If starts with country code without +, add +
      if (/^\d{10,15}$/.test(cleanPhone)) {
        phoneVariants.push(`+${cleanPhone}`);
      }
      // If starts with +237, also try without +
      if (cleanPhone.startsWith('+')) {
        phoneVariants.push(cleanPhone.substring(1));
      }
      // Also try with +237 prefix for local numbers (6XXXXXXXX)
      if (/^6\d{8}$/.test(cleanPhone)) {
        phoneVariants.push(`+237${cleanPhone}`);
        phoneVariants.push(`237${cleanPhone}`);
      }

      for (const phoneVar of phoneVariants) {
        if (destAccount) break;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_number', phoneVar)
          .maybeSingle();

        if (profile && profile.id !== user.id) {
          // Find the recipient's primary account
          const { data: recipientAccount } = await supabase
            .from('accounts')
            .select('id, account_holder_name, user_id, institution_id, identification_scheme')
            .eq('user_id', profile.id)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (recipientAccount) {
            destAccount = recipientAccount;
          }
        }
      }
    }

    // Tier 3c: Try by name lookup via profiles or accounts table
    if (!destAccount && identifier_type === 'NAME') {
      const searchName = destination_account_id.trim();
      // Try account_holder_name on accounts table (case-insensitive)
      const { data: nameAccounts } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id, identification_scheme')
        .ilike('account_holder_name', searchName)
        .eq('is_active', true)
        .neq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (nameAccounts) {
        destAccount = nameAccounts;
      } else {
        // Try profiles.full_name
        const { data: nameProfiles } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', searchName)
          .neq('id', user.id)
          .limit(1)
          .maybeSingle();

        if (nameProfiles) {
          const { data: recipientAccount } = await supabase
            .from('accounts')
            .select('id, account_holder_name, user_id, institution_id, identification_scheme')
            .eq('user_id', nameProfiles.id)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (recipientAccount) {
            destAccount = recipientAccount;
          }
        }
      }
    }

    // Tier 4: Try by DOMESTIC_RIB identification_value
    if (!destAccount) {
      const cleanValue = destination_account_id.replace(/[\s\-]/g, '');
      if (/^\d{23}$/.test(cleanValue)) {
        const { data } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id, identification_scheme')
          .eq('identification_scheme', 'DOMESTIC_RIB')
          .eq('identification_value', cleanValue)
          .eq('is_active', true)
          .maybeSingle();
        destAccount = data;
        if (destAccount) transferRail = 'domestic_interbank';
      }
    }

    // Tier 5: Try IBAN lookup
    if (!destAccount) {
      const cleanIban = destination_account_id.replace(/\s/g, '').toUpperCase();
      if (/^[A-Z]{2}\d{2}/.test(cleanIban) && cleanIban.length >= 15) {
        const { data } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id, identification_scheme')
          .eq('identification_scheme', 'IBAN')
          .eq('identification_value', cleanIban)
          .eq('is_active', true)
          .maybeSingle();
        destAccount = data;
        if (destAccount) transferRail = 'international';
      }
    }

    if (!destAccount) {
      console.error('Destination not found for:', { destination_account_id, identifier_type, cleaned: destination_account_id?.replace?.(/[\s\-]/g, '') });
      return new Response(JSON.stringify({ error: 'Destination account not found. Try an account number, ID, phone number, RIB, or IBAN.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine rail based on institution relationship
    if (transferRail === 'internal' && sourceAccount.institution_id !== destAccount.institution_id) {
      if (destAccount.identification_scheme === 'IBAN') {
        transferRail = 'international';
      } else {
        transferRail = 'domestic_interbank';
      }
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
        institution_id: sourceAccount.institution_id || destAccount.institution_id || '00000000-0000-0000-0000-000000000000',
        credit_debit_indicator: 'Debit',
        status: 'Booked',
        booking_datetime: now,
        value_datetime: now,
        transaction_type: 'Transfer',
        amount: transferAmount,
        currency: txCurrency,
        transaction_information: txDescription,
        merchant_details: {
          transaction_ref: transactionRef,
          destination_account_id: destAccount.id,
          destination_account_holder: destAccount.account_holder_name,
          transfer_type: transferRail,
          rail: transferRail,
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
        institution_id: destAccount.institution_id || sourceAccount.institution_id || '00000000-0000-0000-0000-000000000000',
        credit_debit_indicator: 'Credit',
        status: 'Booked',
        booking_datetime: now,
        value_datetime: now,
        transaction_type: 'Transfer',
        amount: transferAmount,
        currency: txCurrency,
        transaction_information: creditDescription,
        merchant_details: {
          transaction_ref: `${transactionRef}-CR`,
          source_account_id,
          source_account_holder: sourceAccount.account_holder_name,
          transfer_type: transferRail,
          rail: transferRail,
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
      rail: transferRail,
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
