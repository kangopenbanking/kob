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
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate admin user (null-guarded — UK OB compliant)
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

    // Check if user is admin
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      throw new Error('Admin access required');
    }

    const { institution_id, period_start, period_end } = await req.json();

    // Get institution details
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', institution_id)
      .single();

    if (instError || !institution) {
      throw new Error('Institution not found');
    }

    if (!institution.use_kob_flutterwave) {
      throw new Error('Institution not enabled for KOB facilitated payments');
    }

    if (!institution.settlement_bank_account) {
      throw new Error('Settlement account not configured');
    }

    // Calculate settlement balance
    const { data: settlementData, error: calcError } = await supabase.rpc(
      'calculate_settlement_balance',
      {
        _institution_id: institution_id,
        _period_start: period_start,
        _period_end: period_end,
      }
    );

    if (calcError) {
      throw new Error('Failed to calculate settlement');
    }

    const netAmount = settlementData.net_settlement_amount;

    // Check minimum threshold
    if (netAmount < (institution.minimum_settlement_amount || 0)) {
      throw new Error(`Settlement amount ${netAmount} is below minimum threshold ${institution.minimum_settlement_amount}`);
    }

    if (netAmount <= 0) {
      throw new Error('No positive balance to settle');
    }

    // Generate settlement reference
    const settlementRef = `SETTLEMENT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create settlement transaction record
    const { data: settlement, error: settlementError } = await supabase
      .from('settlement_transactions')
      .insert({
        institution_id: institution_id,
        settlement_ref: settlementRef,
        period_start: period_start,
        period_end: period_end,
        total_inflows: settlementData.total_inflows,
        total_outflows: settlementData.total_outflows,
        kob_fees_charged: settlementData.total_kob_fees,
        net_settlement_amount: netAmount,
        settlement_method: institution.settlement_bank_account.type,
        settlement_destination: institution.settlement_bank_account,
        settlement_status: 'processing',
      })
      .select()
      .single();

    if (settlementError) {
      console.error('Settlement record creation error:', settlementError);
      throw new Error('Failed to create settlement record');
    }

    // Initiate Flutterwave transfer
    let flutterwaveResponse;
    const settlementAccount = institution.settlement_bank_account;

    if (settlementAccount.type === 'bank_transfer') {
      flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: settlementAccount.bank_code,
          account_number: settlementAccount.account_number,
          amount: netAmount,
          currency: 'XAF',
          narration: `Settlement for period ${period_start} to ${period_end}`,
          reference: settlementRef,
          callback_url: `${supabaseUrl}/functions/v1/flutterwave-transfer-webhook`,
          beneficiary_name: settlementAccount.account_name,
          meta: {
            settlement_id: settlement.id,
            institution_id: institution_id,
            institution_name: institution.institution_name,
          }
        }),
      });
    } else {
      // Mobile Money settlement
      flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: 'MPS',
          account_number: settlementAccount.phone_number,
          amount: netAmount,
          currency: 'XAF',
          narration: `Settlement for period ${period_start} to ${period_end}`,
          reference: settlementRef,
          callback_url: `${supabaseUrl}/functions/v1/flutterwave-transfer-webhook`,
          beneficiary_name: institution.institution_name,
          meta: {
            settlement_id: settlement.id,
            institution_id: institution_id,
            institution_name: institution.institution_name,
            provider: settlementAccount.provider,
          }
        }),
      });
    }

    const flutterwaveData = await flutterwaveResponse.json();

    if (flutterwaveData.status === 'success') {
      // Update settlement with Flutterwave reference
      await supabase
        .from('settlement_transactions')
        .update({
          flutterwave_transfer_ref: flutterwaveData.data.id.toString(),
          metadata: {
            flutterwave_response: flutterwaveData.data,
          }
        })
        .eq('id', settlement.id);

      // Mark all transactions as settled
      await supabase
        .from('mobile_money_transactions')
        .update({ settlement_id: settlement.id })
        .eq('facilitated_institution_id', institution_id)
        .eq('is_kob_facilitated', true)
        .gte('created_at', period_start)
        .lte('created_at', period_end)
        .is('settlement_id', null);

      await supabase
        .from('bank_transfer_transactions')
        .update({ settlement_id: settlement.id })
        .eq('facilitated_institution_id', institution_id)
        .eq('is_kob_facilitated', true)
        .gte('created_at', period_start)
        .lte('created_at', period_end)
        .is('settlement_id', null);

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _action_type: 'settlement_processed',
        _entity_type: 'settlement_transaction',
        _entity_id: settlement.id,
        _details: {
          institution_id: institution_id,
          net_amount: netAmount,
          settlement_ref: settlementRef,
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          settlement_id: settlement.id,
          settlement_ref: settlementRef,
          net_amount: netAmount,
          flutterwave_transfer_id: flutterwaveData.data.id,
          status: 'processing',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Update settlement as failed
      await supabase
        .from('settlement_transactions')
        .update({
          settlement_status: 'failed',
          error_message: flutterwaveData.message || 'Settlement transfer failed',
        })
        .eq('id', settlement.id);

      throw new Error(flutterwaveData.message || 'Failed to process settlement');
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});