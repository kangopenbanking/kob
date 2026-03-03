// Shared helper: scope-aware crediting for funding intents
// Used by all webhook handlers (Flutterwave, Stripe, PayPal)

export async function creditFundingIntent(supabase: any, fundingIntent: any) {
  const scope = fundingIntent.funding_scope || 'end_user';
  const creditAmount = fundingIntent.net_amount || fundingIntent.amount;
  const now = new Date().toISOString();

  if (scope === 'merchant' && fundingIntent.merchant_id) {
    // Credit merchant wallet via update_merchant_wallet DB function
    await supabase.rpc('update_merchant_wallet', {
      _merchant_id: fundingIntent.merchant_id,
      _currency: fundingIntent.currency,
      _available_delta: creditAmount,
      _ledger_delta: creditAmount,
    });

    await supabase.from('audit_logs').insert({
      action_type: 'funding_intent_merchant_wallet_credited',
      entity_type: 'funding_intent',
      entity_id: fundingIntent.id,
      performed_by: fundingIntent.user_id,
      details: {
        amount: fundingIntent.amount,
        net_amount: creditAmount,
        merchant_id: fundingIntent.merchant_id,
        method: fundingIntent.method,
        funding_scope: scope,
      },
    });
  } else {
    // end_user, institution, external_api — all credit account_balances
    if (!fundingIntent.account_id) {
      console.error('No account_id for non-merchant funding intent', fundingIntent.id);
      return;
    }

    // Upsert ClosingAvailable balance (add to existing or create)
    const { data: existingBalance } = await supabase
      .from('account_balances')
      .select('id, amount')
      .eq('account_id', fundingIntent.account_id)
      .eq('balance_type', 'ClosingAvailable')
      .eq('credit_debit_indicator', 'Credit')
      .maybeSingle();

    if (existingBalance) {
      await supabase.from('account_balances').update({
        amount: existingBalance.amount + creditAmount,
        balance_datetime: now,
      }).eq('id', existingBalance.id);
    } else {
      await supabase.from('account_balances').insert({
        account_id: fundingIntent.account_id,
        balance_type: 'ClosingAvailable',
        amount: creditAmount,
        currency: fundingIntent.currency,
        credit_debit_indicator: 'Credit',
        balance_datetime: now,
      });
    }

    await supabase.from('transactions').insert({
      account_id: fundingIntent.account_id,
      amount: creditAmount,
      currency: fundingIntent.currency,
      credit_debit_indicator: 'Credit',
      status: 'Booked',
      booking_datetime: now,
      value_datetime: now,
      transaction_type: 'deposit',
      transaction_information: `${scope === 'end_user' ? 'Account' : scope === 'institution' ? 'Institution account' : 'API-initiated'} funding via ${fundingIntent.method} - ${fundingIntent.reference}`,
      user_id: fundingIntent.user_id,
      institution_id: fundingIntent.institution_id,
      metadata: {
        funding_intent_id: fundingIntent.id,
        funding_reference: fundingIntent.reference,
        funding_scope: scope,
        method: fundingIntent.method,
        source: 'customer_app',
      },
    });

    await supabase.from('audit_logs').insert({
      action_type: 'funding_intent_succeeded',
      entity_type: 'funding_intent',
      entity_id: fundingIntent.id,
      performed_by: fundingIntent.user_id,
      details: {
        amount: fundingIntent.amount,
        net_amount: creditAmount,
        method: fundingIntent.method,
        funding_scope: scope,
      },
    });
  }
}
