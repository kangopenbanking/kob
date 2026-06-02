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

    const { transaction_ref, transaction_id } = await req.json();

    if (!transaction_ref && !transaction_id) {
      throw new Error('Either transaction_ref or transaction_id is required');
    }

    console.log('Verifying mobile money transaction:', { transaction_ref, transaction_id });

    // Get transaction from database
    let query = supabase
      .from('mobile_money_transactions')
      .select('*')
      .eq('user_id', user.id);

    if (transaction_id) {
      query = query.eq('id', transaction_id);
    } else {
      query = query.eq('transaction_ref', transaction_ref);
    }

    const { data: transaction, error: dbError } = await query.single();

    if (dbError || !transaction) {
      throw new Error('Transaction not found');
    }

    // If already successful or failed, return current status
    if (transaction.status === 'successful' || transaction.status === 'failed') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: transaction.id,
            transaction_ref: transaction.transaction_ref,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
            phone_number: transaction.phone_number,
            provider: transaction.provider,
            completed_at: transaction.completed_at,
            error_message: transaction.error_message
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Verify with Flutterwave
    const flutterwaveResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${transaction.transaction_ref}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const flutterwaveData = await flutterwaveResponse.json();
    console.log('Flutterwave verification response:', flutterwaveData);

    if (flutterwaveData.status === 'success' && flutterwaveData.data) {
      const paymentStatus = flutterwaveData.data.status;
      let dbStatus = 'processing';
      let completedAt = null;

      // Map Flutterwave status to our status
      if (paymentStatus === 'successful') {
        dbStatus = 'successful';
        completedAt = new Date().toISOString();
      } else if (paymentStatus === 'failed') {
        dbStatus = 'failed';
        completedAt = new Date().toISOString();
      }

      // Update transaction status
      const { error: updateError } = await supabase
        .from('mobile_money_transactions')
        .update({
          status: dbStatus,
          flutterwave_ref: flutterwaveData.data.flw_ref || transaction.flutterwave_ref,
          metadata: flutterwaveData.data,
          completed_at: completedAt,
          error_message: paymentStatus === 'failed' ? 'Payment failed' : null
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Failed to update transaction:', updateError);
      }

      // Auto-credit bank account if this is a successful bank deposit (F5: atomic RPC)
      if (dbStatus === 'successful' && transaction.is_bank_deposit && transaction.destination_account_id) {
        console.log('Auto-crediting bank account (atomic):', transaction.destination_account_id);
        try {
          const { data: creditResult, error: creditErr } = await supabase.rpc('atomic_flw_account_credit', {
            _account_id: transaction.destination_account_id,
            _user_id: transaction.user_id,
            _amount: parseFloat(transaction.amount),
            _currency: transaction.currency,
            _tx_ref: transaction.transaction_ref,
            _institution_id: null,
            _provider_ref: flutterwaveData.data.flw_ref ?? null,
            _source: 'mobile_money',
            _metadata: {
              mobile_transaction_id: transaction.id,
              provider: transaction.provider,
              phone_number: transaction.phone_number,
            },
          });

          if (creditErr) {
            console.error('atomic_flw_account_credit failed:', creditErr);
          } else if (creditResult?.transaction_id) {
            await supabase
              .from('mobile_money_transactions')
              .update({ bank_transaction_id: creditResult.transaction_id })
              .eq('id', transaction.id);
            console.log('Bank account credited atomically:', creditResult);
          }
        } catch (autoCredError) {
          console.error('Auto-credit error:', autoCredError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transaction_id: transaction.id,
            transaction_ref: transaction.transaction_ref,
            status: dbStatus,
            amount: flutterwaveData.data.amount,
            currency: flutterwaveData.data.currency,
            phone_number: transaction.phone_number,
            provider: transaction.provider,
            completed_at: completedAt,
            flutterwave_data: flutterwaveData.data
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      throw new Error(flutterwaveData.message || 'Verification failed');
    }

  } catch (error) {
    console.error('Error in mobile-money-verify:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        code: 'MOBILE_MONEY_VERIFY_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
