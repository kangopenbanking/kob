import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

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

    // Check source account balance — prefer ClosingAvailable (matches UI display), fallback to InterimAvailable
    // SECURITY: Filter by credit_debit_indicator='Credit' to ensure accurate available funds
    let sourceBalance = null;
    const { data: closingBal } = await supabase
      .from('account_balances')
      .select('id, amount, balance_type')
      .eq('account_id', source_account_id)
      .eq('balance_type', 'ClosingAvailable')
      .eq('credit_debit_indicator', 'Credit')
      .maybeSingle();

    if (closingBal) {
      sourceBalance = closingBal;
    } else {
      const { data: interimBal } = await supabase
        .from('account_balances')
        .select('id, amount, balance_type')
        .eq('account_id', source_account_id)
        .eq('balance_type', 'InterimAvailable')
        .eq('credit_debit_indicator', 'Credit')
        .maybeSingle();
      sourceBalance = interimBal;
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

    // Tier 1.5: UUID matched no account — try resolving as a profile (user_id).
    // Registered users without a provisioned account can still receive transfers;
    // we auto-create a default wallet on their behalf.
    if (!destAccount && uuidRegex.test(destination_account_id)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .eq('id', destination_account_id)
        .maybeSingle();

      if (profile && profile.id !== user.id) {
        const { data: existing } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id, identification_scheme')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existing) {
          destAccount = existing;
        } else {
          const newAccountId = `ACC-${profile.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
          const { data: created, error: createErr } = await supabase
            .from('accounts')
            .insert({
              user_id: profile.id,
              account_id: newAccountId,
              account_holder_name: profile.full_name || 'Kang User',
              account_type: 'Personal',
              account_subtype: 'CurrentAccount',
              currency: currency || 'XAF',
              identification_scheme: 'IBAN',
              identification_value: newAccountId,
              is_active: true,
            })
            .select('id, account_holder_name, user_id, institution_id, identification_scheme')
            .single();

          if (!createErr && created) {
            destAccount = created;
            console.log('Auto-provisioned destination wallet for profile:', profile.id);
          } else if (createErr) {
            console.warn('Failed to auto-provision wallet:', createErr.message);
          }
        }
      }
    }

    // Tier 1.6: KANG ID lookup (e.g. "KANG-7H3K9PXM2A" or bare digits "85090541")
    const rawDest = destination_account_id.trim();
    const isKangPrefixed = /^KANG-[A-Z0-9]+$/i.test(rawDest);
    const isBareDigits = /^\d{6,12}$/.test(rawDest);
    if (!destAccount && (isKangPrefixed || isBareDigits)) {
      const kangIdNorm = isKangPrefixed ? rawDest.toUpperCase() : `KANG-${rawDest}`;
      const { data: kangProfile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('kang_id', kangIdNorm)
        .maybeSingle();

      if (kangProfile && kangProfile.id !== user.id) {
        const { data: existing } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id, identification_scheme')
          .eq('user_id', kangProfile.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existing) {
          destAccount = existing;
        } else {
          const newAccountId = `ACC-${kangProfile.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
          const { data: created, error: createErr } = await supabase
            .from('accounts')
            .insert({
              user_id: kangProfile.id,
              account_id: newAccountId,
              account_holder_name: kangProfile.full_name || 'Kang User',
              account_type: 'Personal',
              account_subtype: 'CurrentAccount',
              currency: currency || 'XAF',
              identification_scheme: 'IBAN',
              identification_value: newAccountId,
              is_active: true,
            })
            .select('id, account_holder_name, user_id, institution_id, identification_scheme')
            .single();
          if (!createErr && created) {
            destAccount = created;
            console.log('Auto-provisioned destination wallet via KANG ID:', kangIdNorm);
          }
        }
      }
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
      // Try account_holder_name on accounts table (case-insensitive, partial match)
      const { data: nameAccounts } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id, identification_scheme')
        .ilike('account_holder_name', `%${searchName}%`)
        .eq('is_active', true)
        .neq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (nameAccounts) {
        destAccount = nameAccounts;
      } else {
        // Try profiles.full_name (partial match)
        const { data: nameProfiles } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', `%${searchName}%`)
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
      if (/^\d{23}$/.test(cleanValue) || identifier_type === 'DOMESTIC_RIB') {
        const digits = cleanValue.replace(/\D/g, '');
        // 4a: Try identification_value match
        const { data } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id, identification_scheme')
          .eq('identification_scheme', 'DOMESTIC_RIB')
          .eq('identification_value', digits)
          .eq('is_active', true)
          .maybeSingle();
        destAccount = data;

        // 4b: Try composite RIB component fields (rib_bank_code + rib_branch_code + rib_account_number + rib_key)
        if (!destAccount && digits.length === 23) {
          const ribBank = digits.substring(0, 5);
          const ribBranch = digits.substring(5, 10);
          const ribAcct = digits.substring(10, 21);
          const ribKey = digits.substring(21, 23);
          const { data: ribData } = await supabase
            .from('accounts')
            .select('id, account_holder_name, user_id, institution_id, identification_scheme')
            .eq('rib_bank_code', ribBank)
            .eq('rib_branch_code', ribBranch)
            .eq('rib_account_number', ribAcct)
            .eq('rib_key', ribKey)
            .eq('is_active', true)
            .maybeSingle();
          destAccount = ribData;
        }

        // 4c: Try partial match — just rib_account_number (11-digit core)
        if (!destAccount && digits.length >= 11) {
          const coreAcct = digits.length === 23 ? digits.substring(10, 21) : digits;
          const { data: partialData } = await supabase
            .from('accounts')
            .select('id, account_holder_name, user_id, institution_id, identification_scheme')
            .eq('rib_account_number', coreAcct)
            .eq('is_active', true)
            .maybeSingle();
          destAccount = partialData;
        }

        if (destAccount) transferRail = 'domestic_interbank';
      }
    }

    // Tier 5: Try IBAN lookup
    if (!destAccount) {
      const cleanIban = destination_account_id.replace(/\s/g, '').toUpperCase();
      if (/^[A-Z]{2}\d{2}/.test(cleanIban) && cleanIban.length >= 15 || identifier_type === 'IBAN') {
        // 5a: Try identification_value with IBAN scheme
        const { data } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id, identification_scheme')
          .eq('identification_scheme', 'IBAN')
          .eq('identification_value', cleanIban)
          .eq('is_active', true)
          .maybeSingle();
        destAccount = data;

        // 5b: If IBAN starts with CM21, extract RIB and try component lookup
        if (!destAccount && cleanIban.startsWith('CM21') && cleanIban.length >= 27) {
          const ribFromIban = cleanIban.substring(4); // Remove CM21 prefix
          const ribDigits = ribFromIban.replace(/\D/g, '');
          if (ribDigits.length === 23) {
            const { data: ibanRibData } = await supabase
              .from('accounts')
              .select('id, account_holder_name, user_id, institution_id, identification_scheme')
              .eq('rib_bank_code', ribDigits.substring(0, 5))
              .eq('rib_branch_code', ribDigits.substring(5, 10))
              .eq('rib_account_number', ribDigits.substring(10, 21))
              .eq('rib_key', ribDigits.substring(21, 23))
              .eq('is_active', true)
              .maybeSingle();
            destAccount = ibanRibData;
          }
        }

        if (destAccount) transferRail = 'international';
      }
    }

    // Tier 6: Last resort — try identification_value without scheme filter
    if (!destAccount) {
      const cleanFallback = destination_account_id.replace(/[\s\-]/g, '');
      const { data: fallbackData } = await supabase
        .from('accounts')
        .select('id, account_holder_name, user_id, institution_id, identification_scheme')
        .eq('identification_value', cleanFallback)
        .eq('is_active', true)
        .maybeSingle();
      destAccount = fallbackData;
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

    // ══════════════════════════════════════════════
    // ACTIVATION GATE: Detect if recipient has fully activated their account.
    // An "activated" recipient has BOTH a PIN set AND a verified phone number.
    // Unverified recipients receive funds via the pending_inbound_transfers hold table.
    // ══════════════════════════════════════════════
    let recipientIsActivated = true;
    let recipientProfile: any = null;
    if (destAccount.user_id && destAccount.user_id !== user.id) {
      const { data: rp } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, pin_code_hash')
        .eq('id', destAccount.user_id)
        .maybeSingle();
      recipientProfile = rp;
      if (!rp?.pin_code_hash || !rp?.phone_number) {
        recipientIsActivated = false;
      }
    }

    // Generate transaction reference
    const transactionRef = reference || `TXN-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    // ══════════════════════════════════════════════
    // H1 FIX: Idempotency check
    // ══════════════════════════════════════════════
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;
    if (idempotencyKey) {
      const { data: existingTx } = await supabase.rpc('check_transfer_idempotency', {
        _idempotency_key: idempotencyKey,
        _user_id: user.id,
      });
      if (existingTx?.exists) {
        return new Response(JSON.stringify({
          success: true,
          ...existingTx,
          idempotent_replayed: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
        });
      }
    }

    // ══════════════════════════════════════════════
    // C1 FIX: Atomic debit-credit via PL/pgSQL with row locks
    // BRANCH: If recipient is unverified, only debit sender; funds go to hold table.
    // ══════════════════════════════════════════════
    if (recipientIsActivated) {
      const { data: atomicResult, error: atomicError } = await supabase.rpc('execute_atomic_transfer', {
        _source_balance_id: sourceBalance.id,
        _dest_account_id: destAccount.id,
        _amount: transferAmount,
        _currency: txCurrency,
      });

      if (atomicError) {
        console.error('Atomic transfer failed:', atomicError);
        const errMsg = atomicError.message?.includes('Insufficient funds') ? 'Insufficient funds' : 'Failed to process transfer';
        return new Response(JSON.stringify({ error: errMsg }), {
          status: atomicError.message?.includes('Insufficient funds') ? 400 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Unverified recipient: debit sender only (no credit yet)
      const { error: debitOnlyErr } = await supabase.rpc('atomic_debit_balance', {
        _account_id: source_account_id,
        _amount: transferAmount,
        _currency: txCurrency,
      });
      if (debitOnlyErr) {
        console.error('Debit-only failed:', debitOnlyErr);
        const errMsg = debitOnlyErr.message?.includes('Insufficient funds') ? 'Insufficient funds' : 'Failed to process transfer';
        return new Response(JSON.stringify({ error: errMsg }), {
          status: debitOnlyErr.message?.includes('Insufficient funds') ? 400 : 500,
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
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        },
      })
      .select('id')
      .single();

    if (debitTxnErr) {
      console.error('Failed to create debit transaction:', debitTxnErr);
    }

    // ══════════════════════════════════════════════
    // STEP 4: Create credit transaction for receiver
    // If recipient is unverified, mark Pending and create hold record.
    // ══════════════════════════════════════════════
    const creditDescription = recipientIsActivated
      ? (description || `Received from ${sourceAccount.account_holder_name}`)
      : `Funds held — pending account activation. From ${sourceAccount.account_holder_name}`;

    const { data: creditTxn, error: creditTxnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: destAccount.user_id,
        account_id: destAccount.id,
        institution_id: destAccount.institution_id || sourceAccount.institution_id || '00000000-0000-0000-0000-000000000000',
        credit_debit_indicator: 'Credit',
        status: recipientIsActivated ? 'Booked' : 'Pending',
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
          held_pending_activation: !recipientIsActivated,
        },
      })
      .select('id')
      .single();

    // Create the hold record + notify recipient if unverified
    if (!recipientIsActivated && destAccount.user_id) {
      await supabase.from('pending_inbound_transfers').insert({
        sender_user_id: user.id,
        sender_name: sourceAccount.account_holder_name,
        recipient_user_id: destAccount.user_id,
        recipient_phone: recipientProfile?.phone_number || null,
        amount: transferAmount,
        currency: txCurrency,
        source_transaction_id: debitTxn?.id || null,
        status: 'pending_activation',
        notes: description || null,
      });

      await supabase.from('app_notifications').insert({
        user_id: destAccount.user_id,
        type: 'info',
        title: 'Funds Waiting for You',
        message: `${sourceAccount.account_holder_name} sent you ${txCurrency} ${transferAmount.toLocaleString()}. Verify your account (phone + PIN) to receive the funds in your wallet.`,
        icon: 'wallet',
        metadata: {
          amount: transferAmount,
          currency: txCurrency,
          sender_name: sourceAccount.account_holder_name,
          held_pending_activation: true,
          transaction_ref: transactionRef,
        },
      });
    }

    if (creditTxnErr) {
      console.error('Failed to create credit transaction:', creditTxnErr);
    }

    // ══════════════════════════════════════════════
    // STEP 5: Ledger integration (non-blocking) — M1 FIX: correct double-entry for internal transfers
    // For internal transfers between deposit accounts, debit source deposits sub-account and credit destination
    // ══════════════════════════════════════════════
    try {
      const { data: ledgerAccounts } = await supabase
        .from('ledger_accounts')
        .select('id, account_code')
        .in('account_code', ['2001', '2002', '2000']);

      // Use sub-accounts 2001 (source deposits) and 2002 (dest deposits) if available, else skip ledger
      const srcDepositsAcct = ledgerAccounts?.find(a => a.account_code === '2001') || ledgerAccounts?.find(a => a.account_code === '2000');
      const dstDepositsAcct = ledgerAccounts?.find(a => a.account_code === '2002') || ledgerAccounts?.find(a => a.account_code === '2000');

      if (srcDepositsAcct && dstDepositsAcct && srcDepositsAcct.id !== dstDepositsAcct.id) {
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
            { journal_entry_id: journalEntry.id, ledger_account_id: srcDepositsAcct.id, debit: transferAmount, credit: 0 },
            { journal_entry_id: journalEntry.id, ledger_account_id: dstDepositsAcct.id, debit: 0, credit: transferAmount },
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

    // ══════════════════════════════════════════════
    // STEP 7: Award cashback + complete referral (non-blocking)
    // ══════════════════════════════════════════════
    try {
      if (debitTxn?.id) {
        const rewardsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/customer-rewards`;
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        };
        // fire-and-forget
        fetch(rewardsUrl, { method: 'POST', headers, body: JSON.stringify({
          action: 'award_cashback', user_id: user.id, transaction_id: debitTxn.id, amount: transferAmount,
        }) }).catch(e => console.error('cashback hook err:', e));
        fetch(rewardsUrl, { method: 'POST', headers, body: JSON.stringify({
          action: 'complete_referral', triggering_user_id: user.id,
        }) }).catch(e => console.error('referral complete hook err:', e));
      }
    } catch (rewardErr) {
      console.error('Reward hook failed (non-blocking):', rewardErr);
    }

    console.log(`Transfer ${transactionRef} completed: ${transferAmount} ${txCurrency} from ${source_account_id} to ${destAccount.id}`);

    return new Response(JSON.stringify({
      success: true,
      transaction_reference: transactionRef,
      transaction_id: debitTxn?.id,
      status: recipientIsActivated ? 'Booked' : 'HeldPendingActivation',
      held_pending_activation: !recipientIsActivated,
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
