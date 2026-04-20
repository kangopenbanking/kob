import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { calculateGatewayFee } from "../_shared/gateway-adapters.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user (null-guarded — UK OB compliant)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ Code: '401', Message: 'Unauthorized', Errors: [{ ErrorCode: 'UK.OBIE.Unauthorized', Message: 'Missing or malformed Authorization header' }] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ Code: '401', Message: 'Unauthorized', Errors: [{ ErrorCode: 'UK.OBIE.Unauthorized', Message: 'Invalid or expired token' }] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      account_bank,
      account_number,
      amount,
      currency,
      narration,
      beneficiary_name,
      metadata 
    } = await req.json();

    // Get institution details
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('id, institution_name, use_kob_flutterwave, kob_payment_fee_structure_id')
      .eq('user_id', user.id)
      .single();

    if (instError || !institution) {
      throw new Error('Institution not found');
    }

    if (!institution.use_kob_flutterwave) {
      throw new Error('Institution not enabled for KOB facilitated payments');
    }

    // Generate transaction reference
    const transactionRef = `KOB-BT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Calculate KOB fee using unified fee engine
    let kobFeeAmount = 0;
    if (institution.kob_payment_fee_structure_id) {
      const { data: feeCalc } = await supabase.rpc('calculate_transaction_fee', {
        _institution_id: institution.id,
        _transaction_type: 'bank_transfer',
        _transaction_amount: amount,
      });
      
      if (feeCalc) {
        kobFeeAmount = feeCalc.final_fee || 0;
      }
    } else {
      // Dynamic fallback: query fee_structures via gateway adapter
      const feeResult = await calculateGatewayFee(amount, 'bank_transfer', supabase, { institutionId: institution.id });
      kobFeeAmount = feeResult.fee;
    }

    // Insert pending transaction
    const { data: transaction, error: txError } = await supabase
      .from('bank_transfer_transactions')
      .insert({
        user_id: user.id,
        transaction_ref: transactionRef,
        bank_code: account_bank,
        account_number: account_number,
        account_name: beneficiary_name,
        amount: amount,
        currency: currency,
        narration: narration,
        transaction_type: 'debit',
        status: 'pending',
        is_kob_facilitated: true,
        facilitated_institution_id: institution.id,
        kob_fee_amount: kobFeeAmount,
        metadata: {
          ...metadata,
          institution_name: institution.institution_name,
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction insert error:', txError);
      throw new Error('Failed to create transaction record');
    }

    // Initiate Flutterwave transfer
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: account_bank,
        account_number: account_number,
        amount: amount,
        currency: currency,
        narration: narration || `Transfer facilitated by ${institution.institution_name}`,
        reference: transactionRef,
        callback_url: `${supabaseUrl}/functions/v1/flutterwave-transfer-webhook`,
        debit_currency: currency,
        meta: {
          facilitated_by: 'kang_open_banking',
          institution_id: institution.id,
          institution_name: institution.institution_name,
          kob_fee: kobFeeAmount,
        }
      }),
    });

    const flutterwaveData = await flutterwaveResponse.json();

    if (flutterwaveData.status === 'success') {
      // Update transaction with Flutterwave reference
      await supabase
        .from('bank_transfer_transactions')
        .update({
          flutterwave_ref: flutterwaveData.data.id.toString(),
          status: 'processing',
          metadata: {
            ...transaction.metadata,
            flutterwave_response: flutterwaveData.data,
          }
        })
        .eq('id', transaction.id);

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _action_type: 'facilitated_transfer_initiated',
        _entity_type: 'bank_transfer_transaction',
        _entity_id: transaction.id,
        _details: {
          institution_id: institution.id,
          amount: amount,
          currency: currency,
          kob_fee: kobFeeAmount,
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          transaction_ref: transactionRef,
          transaction_id: transaction.id,
          transfer_id: flutterwaveData.data.id,
          kob_fee_amount: kobFeeAmount,
          net_amount: amount - kobFeeAmount,
          status: 'processing',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Update transaction as failed
      await supabase
        .from('bank_transfer_transactions')
        .update({
          status: 'failed',
          error_message: flutterwaveData.message || 'Flutterwave transfer failed',
        })
        .eq('id', transaction.id);

      throw new Error(flutterwaveData.message || 'Failed to initiate transfer');
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});