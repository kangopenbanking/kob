import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins, notifyUser } from "../_shared/admin-notify.ts";
import { sendManagedEmail } from "../_shared/send-managed-email.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `${Deno.env.get("SUPABASE_URL")!}/functions/v1/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only POST is supported');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth — admin only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    // Verify admin role
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) return rfc7807('forbidden', 'Forbidden', 403, 'Admin access required');

    const body = await req.json();
    // Support BOTH: payout_id (from admin UI) and transaction_id (legacy)
    const { payout_id, transaction_id, reason } = body;

    if (!payout_id && !transaction_id) {
      return rfc7807('validation_error', 'Validation Error', 400, 'Either payout_id or transaction_id is required');
    }

    // ═══════════════════════════════════════════════
    // PATH A: Reverse by payout_id (primary flow from admin UI)
    // ═══════════════════════════════════════════════
    if (payout_id) {
      const { data: payout, error: fetchErr } = await supabase
        .from('gateway_payouts')
        .select('*')
        .eq('id', payout_id)
        .single();

      if (fetchErr || !payout) return rfc7807('not_found', 'Payout Not Found', 404, 'Payout does not exist');

      // Only reversible in pending, processing, or completed
      const reversibleStatuses = ['pending', 'processing', 'completed'];
      if (!reversibleStatuses.includes(payout.status)) {
        return rfc7807('payout_not_reversible', 'Payout Not Reversible', 409,
          `Payout is in '${payout.status}' state. Only payouts in pending, processing, or completed status can be reversed.`);
      }

      if (payout.status === 'reversed') {
        return rfc7807('already_reversed', 'Already Reversed', 409, 'This payout has already been reversed');
      }

      const isConsumerPayout = payout.metadata?.withdrawal === true || !payout.merchant_id;
      const isMerchantPayout = !!payout.merchant_id;
      const totalDebit = payout.amount + (payout.fee_amount || 0);
      let balanceRestored = false;

      // ── Restore consumer balance ──
      if (isConsumerPayout && payout.metadata?.account_id) {
        const accountId = payout.metadata.account_id;
        const { data: balanceRecord } = await supabase
          .from('account_balances')
          .select('id, amount')
          .eq('account_id', accountId)
          .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
          .order('balance_datetime', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (balanceRecord) {
          await supabase.from('account_balances').update({
            amount: balanceRecord.amount + totalDebit,
            balance_datetime: new Date().toISOString(),
          }).eq('id', balanceRecord.id);
          balanceRestored = true;
        }
      }

      // ── Restore merchant wallet balance ──
      if (isMerchantPayout) {
        await supabase.rpc('update_merchant_wallet', {
          _merchant_id: payout.merchant_id,
          _currency: payout.currency,
          _available_delta: payout.amount,
          _ledger_delta: payout.amount,
        });
        balanceRestored = true;
      }

      // ── Update payout status ──
      await supabase.from('gateway_payouts').update({
        status: 'reversed',
        failure_reason: reason || 'Reversed by admin',
        updated_at: new Date().toISOString(),
      }).eq('id', payout_id);

      // ── Update associated transaction if exists ──
      if (payout.tx_ref) {
        await supabase.from('transactions').update({
          status: 'reversed',
          transaction_information: `REVERSED by admin — ${reason || 'Admin reversal'}`,
        }).eq('metadata->>tx_ref', payout.tx_ref)
          .eq('transaction_type', 'withdrawal');

        // Create reversal credit transaction
        const payoutUserId = payout.metadata?.user_id;
        if (payoutUserId && payout.metadata?.account_id) {
          await supabase.from('transactions').insert({
            user_id: payoutUserId,
            account_id: payout.metadata.account_id,
            transaction_type: 'reversal',
            amount: totalDebit,
            currency: payout.currency,
            status: 'completed',
            credit_debit_indicator: 'Credit',
            transaction_information: `Reversal of payout ${payout_id} — ${reason || 'Admin reversal'}`,
            booking_datetime: new Date().toISOString(),
            value_datetime: new Date().toISOString(),
            metadata: {
              original_payout_id: payout_id,
              original_tx_ref: payout.tx_ref,
              reversed_by: user.id,
              reason,
            },
          });
        }
      }

      // ── Audit log ──
      const fmtAmt = new Intl.NumberFormat('fr-CM').format(payout.amount);
      await supabase.from('audit_logs').insert({
        action_type: 'payout_reversed',
        entity_type: 'gateway_payout',
        entity_id: payout_id,
        performed_by: user.id,
        details: {
          reason,
          amount: payout.amount,
          fee_amount: payout.fee_amount,
          total_restored: totalDebit,
          currency: payout.currency,
          provider: payout.provider,
          channel: payout.channel,
          tx_ref: payout.tx_ref,
          was_consumer_withdrawal: isConsumerPayout,
          was_merchant_payout: isMerchantPayout,
          balance_restored: balanceRestored,
          original_status: payout.status,
        },
      });

      // ── Notifications ──
      const payoutUserId = payout.metadata?.user_id;

      notifyAdmins(supabase, {
        event_type: 'payout_reversed',
        entity_type: 'gateway_payout',
        entity_id: payout_id,
        title: '🔄 Payout Reversed by Admin',
        message: `${payout.currency} ${fmtAmt} payout reversed and ${balanceRestored ? 'balance restored' : 'balance restoration skipped (no account found)'}. Reason: ${reason || 'Admin action'}. Ref: ${payout.tx_ref}`,
        metadata: { payout_id, amount: payout.amount, reversed_by: user.id, reason },
      });

      if (payoutUserId) {
        notifyUser(supabase, {
          user_id: payoutUserId,
          type: 'success',
          title: 'Withdrawal Reversed — Funds Restored',
          message: `${payout.currency} ${fmtAmt} has been credited back to your account. Reason: ${reason || 'The withdrawal could not be completed.'}`,
          icon: 'cash_out',
          metadata: { payout_id, amount: payout.amount },
        });

        sendManagedEmail(supabase, {
          email_key: 'withdrawal_reversal_notification',
          recipient_user_id: payoutUserId,
          variables: { currency: payout.currency, amount: fmtAmt, reason: reason || 'Provider failed to deliver funds', tx_ref: payout.tx_ref || payout_id },
        });
      }

      return json({
        success: true,
        payout_id,
        status: 'reversed',
        reversed_amount: payout.amount,
        fee_restored: payout.fee_amount || 0,
        total_restored: totalDebit,
        balance_restored: balanceRestored,
        reversed_by: user.id,
        reason: reason || 'Reversed by admin',
        reversed_at: new Date().toISOString(),
      });
    }

    // ═══════════════════════════════════════════════
    // PATH B: Legacy — reverse by transaction_id
    // ═══════════════════════════════════════════════
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txError || !tx) return rfc7807('not_found', 'Not Found', 404, 'Transaction not found');

    if (tx.status === 'reversed') {
      return rfc7807('already_reversed', 'Already Reversed', 409, 'This transaction has already been reversed');
    }

    if (tx.transaction_type !== 'withdrawal') {
      return rfc7807('invalid_type', 'Invalid Type', 400, 'Only withdrawal transactions can be reversed via this endpoint');
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

    const fmtAmt = new Intl.NumberFormat('fr-CM').format(reversalAmount);

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

    notifyAdmins(supabase, {
      event_type: 'withdrawal_reversed',
      entity_type: 'transaction',
      entity_id: transaction_id,
      title: '🔄 Withdrawal Reversed by Admin',
      message: `${tx.currency} ${fmtAmt} withdrawal reversed and credited back. Reason: ${reason || 'Provider failure'}. Performed by admin.`,
      metadata: { transaction_id, amount: reversalAmount, reversed_by: user.id, reason },
    });

    if (tx.user_id) {
      notifyUser(supabase, {
        user_id: tx.user_id,
        type: 'success',
        title: 'Withdrawal Reversed — Funds Restored',
        message: `${tx.currency} ${fmtAmt} has been credited back to your account. Reason: ${reason || 'The withdrawal could not be completed.'}`,
        icon: 'cash_out',
        metadata: { transaction_id, amount: reversalAmount },
      });

      sendManagedEmail(supabase, {
        email_key: 'withdrawal_reversal_notification',
        recipient_user_id: tx.user_id,
        variables: { currency: tx.currency, amount: fmtAmt, reason: reason || 'Provider failed to deliver funds', tx_ref: txMeta?.tx_ref || transaction_id },
      });
    }

    return json({
      success: true,
      transaction_id,
      reversed_amount: reversalAmount,
      balance_restored: true,
      reversed_by: user.id,
    });

  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] admin-reverse-withdrawal error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});
