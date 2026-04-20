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
      phone_number, 
      amount, 
      currency, 
      email,
      redirect_url,
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
    const transactionRef = `KOB-MM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Calculate KOB fee using unified fee engine
    let kobFeeAmount = 0;
    if (institution.kob_payment_fee_structure_id) {
      const { data: feeCalc } = await supabase.rpc('calculate_transaction_fee', {
        _institution_id: institution.id,
        _transaction_type: 'mobile_money_charge',
        _transaction_amount: amount,
      });
      
      if (feeCalc) {
        kobFeeAmount = feeCalc.final_fee || 0;
      }
    } else {
      // Dynamic fallback: query fee_structures via gateway adapter
      const feeResult = await calculateGatewayFee(amount, 'mobile_money', supabase, { institutionId: institution.id });
      kobFeeAmount = feeResult.fee;
    }

    // Insert pending transaction
    const { data: transaction, error: txError } = await supabase
      .from('mobile_money_transactions')
      .insert({
        user_id: user.id,
        transaction_ref: transactionRef,
        phone_number,
        amount,
        currency,
        transaction_type: 'charge',
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

    // Initiate Flutterwave charge
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_cameroon', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: transactionRef,
        amount: amount,
        currency: currency,
        email: email || `${user.id}@facilitated.kob.cm`,
        phone_number: phone_number,
        fullname: institution.institution_name,
        redirect_url: redirect_url,
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
        .from('mobile_money_transactions')
        .update({
          flutterwave_ref: flutterwaveData.data.flw_ref,
          status: 'processing',
          metadata: {
            ...transaction.metadata,
            flutterwave_response: flutterwaveData.data,
          }
        })
        .eq('id', transaction.id);

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _action_type: 'facilitated_payment_initiated',
        _entity_type: 'mobile_money_transaction',
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
          flutterwave_link: flutterwaveData.data.link,
          kob_fee_amount: kobFeeAmount,
          net_amount: amount - kobFeeAmount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Update transaction as failed
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'failed',
          error_message: flutterwaveData.message || 'Flutterwave charge failed',
        })
        .eq('id', transaction.id);

      throw new Error(flutterwaveData.message || 'Failed to initiate charge');
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});