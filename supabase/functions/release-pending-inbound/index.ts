import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Releases all pending_inbound_transfers for the authenticated user.
 * Called when:
 *   - User completes mandatory PIN setup
 *   - CustomerHome mounts (catch-all safety)
 *
 * Promotes Pending credit transactions to Booked, credits the wallet,
 * and marks the hold record as 'released'.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Verify recipient has now activated (PIN + phone)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number, pin_code_hash')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.pin_code_hash || !profile?.phone_number) {
      return new Response(JSON.stringify({
        success: false,
        released_count: 0,
        reason: 'Account not yet fully activated (PIN + phone required).',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find pending holds for this recipient
    const { data: holds, error: holdsErr } = await supabase
      .from('pending_inbound_transfers')
      .select('*')
      .eq('recipient_user_id', user.id)
      .eq('status', 'pending_activation');

    if (holdsErr) throw holdsErr;
    if (!holds || holds.length === 0) {
      return new Response(JSON.stringify({ success: true, released_count: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get recipient's primary account
    const { data: account } = await supabase
      .from('accounts')
      .select('id, currency')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({
        success: false, released_count: 0, reason: 'No active wallet account found.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let releasedCount = 0;
    let totalAmount = 0;
    const currency = account.currency || 'XAF';

    for (const hold of holds) {
      try {
        // Find or create the wallet balance
        let { data: bal } = await supabase
          .from('account_balances')
          .select('id, amount')
          .eq('account_id', account.id)
          .eq('balance_type', 'ClosingAvailable')
          .eq('credit_debit_indicator', 'Credit')
          .maybeSingle();

        if (!bal) {
          const { data: newBal } = await supabase
            .from('account_balances')
            .insert({
              account_id: account.id,
              amount: 0,
              balance_type: 'ClosingAvailable',
              credit_debit_indicator: 'Credit',
              currency,
              balance_datetime: new Date().toISOString(),
            })
            .select('id, amount')
            .single();
          bal = newBal;
        }

        // Credit the balance
        await supabase
          .from('account_balances')
          .update({
            amount: Number(bal!.amount) + Number(hold.amount),
            balance_datetime: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', bal!.id);

        // Promote pending credit transaction to Booked
        await supabase
          .from('transactions')
          .update({ status: 'Booked', value_datetime: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('account_id', account.id)
          .eq('credit_debit_indicator', 'Credit')
          .eq('status', 'Pending')
          .eq('amount', hold.amount);

        // Mark hold released
        await supabase
          .from('pending_inbound_transfers')
          .update({ status: 'released', released_at: new Date().toISOString() })
          .eq('id', hold.id);

        // Notify recipient
        await supabase.from('app_notifications').insert({
          user_id: user.id,
          type: 'success',
          title: 'Funds Released to Your Wallet',
          message: `${hold.currency} ${Number(hold.amount).toLocaleString()} from ${hold.sender_name || 'a sender'} is now available in your wallet.`,
          icon: 'wallet',
          metadata: { amount: hold.amount, currency: hold.currency, hold_id: hold.id },
        });

        // Notify sender that recipient activated
        if (hold.sender_user_id) {
          await supabase.from('app_notifications').insert({
            user_id: hold.sender_user_id,
            type: 'success',
            title: 'Recipient Activated — Funds Delivered',
            message: `${profile.full_name || 'The recipient'} has activated their account. Your transfer of ${hold.currency} ${Number(hold.amount).toLocaleString()} has been delivered.`,
            icon: 'check',
            metadata: { amount: hold.amount, currency: hold.currency, hold_id: hold.id },
          });
        }

        releasedCount++;
        totalAmount += Number(hold.amount);
      } catch (err) {
        console.error('Failed to release hold', hold.id, err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      released_count: releasedCount,
      total_amount: totalAmount,
      currency,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('release-pending-inbound error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
