import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth — admin only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'forbidden', message: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { transaction_id, reason } = body;

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: 'invalid_request', message: 'transaction_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the transaction
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: 'not_found', message: 'Transaction not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tx.status === 'reversed') {
      return new Response(JSON.stringify({ error: 'already_reversed', message: 'This transaction has already been reversed' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tx.transaction_type !== 'withdrawal') {
      return new Response(JSON.stringify({ error: 'invalid_type', message: 'Only withdrawal transactions can be reversed via this endpoint' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reversalAmount = tx.amount;
    const accountId = tx.account_id;

    // Credit back the wallet
    if (accountId) {
      const { data: balanceRecord } = await supabase
        .from('account_balances')
        .select('*')
        .eq('account_id', accountId)
        .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
        .order('balance_datetime', { ascending: false })
        .limit(1)
        .single();

      if (balanceRecord) {
        await supabase.from('account_balances')
          .update({
            amount: (balanceRecord.amount || 0) + reversalAmount,
            balance_datetime: new Date().toISOString(),
          })
          .eq('id', balanceRecord.id);
      }
    }

    // Update transaction status
    await supabase.from('transactions')
      .update({
        status: 'reversed',
        transaction_information: `REVERSED by admin - ${reason || 'Provider failed to deliver funds'}. Original: ${tx.transaction_information}`,
      })
      .eq('id', transaction_id);

    // Update gateway_payouts if linked
    const txMeta = tx.metadata as any;
    if (txMeta?.tx_ref) {
      await supabase.from('gateway_payouts')
        .update({ status: 'reversed' })
        .eq('tx_ref', txMeta.tx_ref);
    }

    // Create reversal credit transaction
    await supabase.from('transactions').insert({
      user_id: tx.user_id,
      institution_id: tx.institution_id,
      account_id: accountId,
      transaction_type: 'reversal',
      amount: reversalAmount,
      currency: tx.currency,
      status: 'completed',
      credit_debit_indicator: 'Credit',
      transaction_information: `Reversal of failed withdrawal ${transaction_id} - ${reason || 'Admin reversal'}`,
      booking_datetime: new Date().toISOString(),
      value_datetime: new Date().toISOString(),
      metadata: {
        original_transaction_id: transaction_id,
        reversed_by: user.id,
        reason,
      },
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'admin_withdrawal_reversal',
      entity_type: 'transaction',
      entity_id: transaction_id,
      performed_by: user.id,
      details: {
        original_amount: reversalAmount,
        currency: tx.currency,
        account_id: accountId,
        user_id: tx.user_id,
        reason,
        original_status: tx.status,
        original_metadata: txMeta,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully reversed XAF ${reversalAmount} back to user wallet`,
      transaction_id,
      reversed_amount: reversalAmount,
      reversed_by: user.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Admin reversal error:', err);
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] admin-reverse-withdrawal error:`, err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      error_id: errorId,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
