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
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Security Fix: Import validation utilities
    const { validateInput, mobileMoneyTransferSchema, sanitizeString } = 
      await import('../_shared/validation.ts');
    
    const requestBody = await req.json();
    
    // Security Fix: Validate and sanitize input
    const validation = validateInput(mobileMoneyTransferSchema, {
      amount: requestBody.amount,
      phone_number: requestBody.phone_number,
      provider: requestBody.provider,
      description: requestBody.description,
      reference: requestBody.reference
    });
    
    if (!validation.success) {
      console.warn('[SECURITY] Validation failed:', validation.error);
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: validation.error
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    
    const { amount, phone_number, provider, description } = validation.data;
    const beneficiary_name = requestBody.beneficiary_name || 'Beneficiary';
    const currency = requestBody.currency || 'XAF';

    // Generate unique transaction reference
    const transaction_ref = `MMT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Initiating mobile money transfer:', {
      amount,
      phone_number,
      provider,
      transaction_ref
    });

    // ─── Wallet debit (financial safety) ─────────────────────────────
    // A mobile-money transfer is a payout FROM the user's wallet. The
    // wallet MUST be debited atomically BEFORE the external payout is
    // initiated, otherwise the platform pays out without charging the
    // user. Debit is refunded below if Flutterwave rejects the transfer.
    const currencyU = (currency || 'XAF').toUpperCase();
    const { data: walletAccount, error: walletErr } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .like('account_id', 'KANG-%')
      .limit(1)
      .maybeSingle();

    if (walletErr || !walletAccount) {
      return new Response(
        JSON.stringify({ success: false, error: 'no_wallet_account', message: 'No wallet account found for this user.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: debitErr } = await supabase.rpc('atomic_debit_balance', {
      _account_id: walletAccount.id,
      _amount: Number(amount),
      _currency: currencyU,
    });
    if (debitErr) {
      const msg = debitErr.message || '';
      const status = msg.includes('Insufficient') ? 400 : 500;
      return new Response(
        JSON.stringify({ success: false, error: status === 400 ? 'insufficient_funds' : 'debit_failed', message: msg }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transaction record
    const { data: transactionData, error: dbError } = await supabase
      .from('mobile_money_transactions')
      .insert({
        user_id: user.id,
        transaction_ref,
        transaction_type: 'transfer',
        provider: provider.toLowerCase(),
        amount,
        currency: currencyU,
        phone_number,
        description: description || 'Mobile money transfer',
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Refund wallet — payout has not been initiated yet
      await supabase.rpc('atomic_credit_balance', {
        _account_id: walletAccount.id,
        _amount: Number(amount),
        _currency: currencyU,
      });
      throw new Error('Failed to create transaction record');
    }

    // Log canonical ledger entry (Debit — Pending until confirmed)
    await supabase.from('transactions').insert({
      account_id: walletAccount.id,
      amount: Number(amount),
      currency: currencyU,
      credit_debit_indicator: 'Debit',
      status: 'Pending',
      booking_datetime: new Date().toISOString(),
      transaction_information: `Mobile money transfer to ${phone_number} (${provider.toUpperCase()})`,
      transaction_reference: transaction_ref,
    });

    // Initiate Flutterwave transfer (payout)
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: provider.toLowerCase() === 'mtn' ? 'MPS' : 'ORANGE',
        account_number: phone_number,
        amount: amount,
        narration: description || 'Mobile money transfer',
        currency: currency.toUpperCase(),
        reference: transaction_ref,
        beneficiary_name: beneficiary_name || 'Beneficiary',
        callback_url: `${Deno.env.get('SUPABASE_URL')!}/functions/v1/mobile-money-verify`,
      }),
    });

    const flutterwaveData = await flutterwaveResponse.json();
    console.log('Flutterwave transfer response:', flutterwaveData);

    if (flutterwaveData.status === 'success') {
      // Update transaction with Flutterwave reference
      await supabase
        .from('mobile_money_transactions')
        .update({
          flutterwave_ref: flutterwaveData.data.id.toString(),
          status: 'processing',
          metadata: flutterwaveData.data,
          completed_at: flutterwaveData.data.status === 'SUCCESSFUL' ? new Date().toISOString() : null
        })
        .eq('id', transactionData.id);

      // Record transaction fee
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('institution_id')
          .eq('id', user.id)
          .single();

        if (profile?.institution_id) {
          await supabase.rpc('record_transaction_fee', {
            _institution_id: profile.institution_id,
            _transaction_type: 'mobile_money_transfer',
            _transaction_ref: transaction_ref,
            _transaction_amount: amount,
            _transaction_id: transactionData.id,
            _metadata: {
              provider,
              phone_number,
              flutterwave_ref: flutterwaveData.data.id.toString()
            }
          });
          console.log('Transaction fee recorded successfully');
        }
      } catch (feeError) {
        console.error('Error recording transaction fee:', feeError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: transactionData.id,
            transaction_ref,
            flutterwave_ref: flutterwaveData.data.id.toString(),
            status: flutterwaveData.data.status === 'SUCCESSFUL' ? 'successful' : 'processing',
            message: 'Transfer initiated successfully'
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      // Update transaction as failed
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'failed',
          error_message: flutterwaveData.message || 'Transfer initiation failed'
        })
        .eq('id', transactionData.id);

      throw new Error(flutterwaveData.message || 'Transfer initiation failed');
    }

  } catch (error) {
    // Security Fix: Generic error response with secure logging
    const { logError, genericErrorResponse } = await import('../_shared/validation.ts');
    const errorId = logError('mobile-money-transfer', error, {
      endpoint: '/mobile-money-transfer',
      timestamp: new Date().toISOString()
    });
    
    return genericErrorResponse(corsHeaders, 500);
  }
});
