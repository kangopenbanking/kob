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
    const { validateInput, bankTransferSchema, sanitizeString } = 
      await import('../_shared/validation.ts');
    
    const requestBody = await req.json();
    
    // Security Fix: Validate and sanitize input
    const validation = validateInput(bankTransferSchema, {
      amount: requestBody.amount,
      bank_code: requestBody.account_bank,
      account_number: requestBody.account_number,
      account_name: requestBody.beneficiary_name,
      narration: requestBody.narration,
      currency: requestBody.currency || 'XAF'
    });
    
    if (!validation.success) {
      console.warn('[SECURITY] Bank transfer validation failed:', validation.error);
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
    
    const { amount, bank_code: account_bank, account_number, account_name: beneficiary_name, narration, currency } = validation.data;
    const bank_name = requestBody.bank_name;
    
    if (!bank_name) {
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Bank name is required'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('[SECURE] Initiating bank transfer for user:', user.id);

    // Generate transaction reference
    const transaction_ref = `BANK-${crypto.randomUUID()}`;

    // Create transaction record
    const { data: transaction, error: insertError } = await supabase
      .from('bank_transfer_transactions')
      .insert({
        user_id: user.id,
        transaction_ref,
        transaction_type: 'transfer',
        bank_code: account_bank,
        bank_name,
        account_number,
        account_name: beneficiary_name,
        amount,
        currency: currency,
        narration: narration || 'Bank transfer',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create transaction record:', insertError);
      throw new Error('Failed to create transaction record');
    }

    console.log('Transaction record created:', transaction.id);

    // Initiate Flutterwave transfer
    const transferResponse = await fetch(
      'https://api.flutterwave.com/v3/transfers',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank,
          account_number,
          amount,
          currency: currency,
          narration: narration || 'Bank transfer',
          reference: transaction_ref,
          callback_url: `${supabaseUrl}/functions/v1/flutterwave-transfer-webhook`,
          debit_currency: currency,
        })
      }
    );

    const transferData = await transferResponse.json();

    if (!transferResponse.ok || transferData.status !== 'success') {
      console.error('Flutterwave transfer error:', transferData);
      
      // Update transaction as failed
      await supabase
        .from('bank_transfer_transactions')
        .update({
          status: 'failed',
          error_message: transferData.message || 'Transfer failed',
        })
        .eq('id', transaction.id);

      throw new Error(transferData.message || 'Failed to initiate transfer');
    }

    console.log('Flutterwave transfer initiated:', transferData.data?.id);

    // Update transaction with Flutterwave reference
    const { error: updateError } = await supabase
      .from('bank_transfer_transactions')
      .update({
        flutterwave_ref: transferData.data?.id?.toString(),
        status: 'processing',
        metadata: transferData.data,
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('Failed to update transaction:', updateError);
    }

    // Get user's institution_id for fee recording
    const { data: profile } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (profile?.institution_id) {
      // Record transaction fee
      await supabase.rpc('record_transaction_fee', {
        _institution_id: profile.institution_id,
        _transaction_type: 'bank_transfer',
        _transaction_ref: transaction_ref,
        _transaction_amount: amount,
        _transaction_id: transaction.id,
        _metadata: {
          flutterwave_ref: transferData.data?.id,
          bank_code: account_bank,
          bank_name,
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_ref,
        flutterwave_ref: transferData.data?.id,
        status: 'processing',
        message: 'Transfer initiated successfully',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    // Security Fix: Generic error response with secure logging
    const { logError, genericErrorResponse } = await import('../_shared/validation.ts');
    const errorId = logError('flutterwave-bank-transfer', error, {
      endpoint: '/flutterwave-bank-transfer',
      timestamp: new Date().toISOString()
    });
    
    return genericErrorResponse(corsHeaders, 500);
  }
});
