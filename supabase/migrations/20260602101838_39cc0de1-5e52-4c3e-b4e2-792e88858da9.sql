-- ═══════════════════════════════════════════════════════════════
-- Batch H / F5: Atomic Flutterwave-driven account credit
-- Row-locks ClosingAvailable balance + idempotent transaction insert
-- Used by: gateway-webhook-flutterwave (fund_account) and
--          mobile-money-verify (auto-credit bank deposits)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.atomic_flw_account_credit(
  _account_id UUID,
  _user_id UUID,
  _amount NUMERIC,
  _currency TEXT,
  _tx_ref TEXT,
  _institution_id UUID DEFAULT NULL,
  _provider_ref TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'flutterwave',
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance_id UUID;
  v_current_amount NUMERIC;
  v_new_amount NUMERIC;
  v_tx_id UUID;
  v_existing_tx UUID;
  v_inst_id UUID;
  v_now TIMESTAMPTZ := now();
  v_tx_reference TEXT := 'FLW-CR-' || _tx_ref;
BEGIN
  IF _account_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_input: account_id and positive amount required';
  END IF;

  -- Idempotency guard: skip if this tx_ref already credited
  SELECT id INTO v_existing_tx FROM public.transactions
   WHERE transaction_reference = v_tx_reference
   LIMIT 1;
  IF v_existing_tx IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'transaction_id', v_existing_tx,
      'credited', false
    );
  END IF;

  -- Resolve institution_id if missing
  v_inst_id := _institution_id;
  IF v_inst_id IS NULL THEN
    SELECT institution_id INTO v_inst_id FROM public.accounts WHERE id = _account_id;
  END IF;

  -- Lock and read the ClosingAvailable balance row (FOR UPDATE)
  SELECT id, amount INTO v_balance_id, v_current_amount
    FROM public.account_balances
   WHERE account_id = _account_id
     AND balance_type = 'ClosingAvailable'
     AND credit_debit_indicator = 'Credit'
   ORDER BY balance_datetime DESC
   LIMIT 1
   FOR UPDATE;

  v_new_amount := COALESCE(v_current_amount, 0) + _amount;

  IF v_balance_id IS NOT NULL THEN
    UPDATE public.account_balances
       SET amount = v_new_amount,
           balance_datetime = v_now
     WHERE id = v_balance_id;
  ELSE
    INSERT INTO public.account_balances (
      account_id, balance_type, credit_debit_indicator,
      amount, currency, balance_datetime
    ) VALUES (
      _account_id, 'ClosingAvailable', 'Credit',
      _amount, _currency, v_now
    ) RETURNING id INTO v_balance_id;
  END IF;

  -- Insert atomic transaction record
  INSERT INTO public.transactions (
    user_id, account_id, institution_id,
    transaction_reference, amount, currency,
    credit_debit_indicator, status,
    booking_datetime, value_datetime,
    transaction_information, transaction_type,
    merchant_details
  ) VALUES (
    _user_id, _account_id, v_inst_id,
    v_tx_reference, _amount, _currency,
    'Credit', 'Booked',
    v_now, v_now,
    'Account credit via ' || _source || ' - ' || _tx_ref,
    'deposit',
    jsonb_build_object(
      'source', _source,
      'tx_ref', _tx_ref,
      'provider_ref', _provider_ref
    ) || COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_tx_id;

  -- Audit log
  INSERT INTO public.audit_logs (
    action_type, entity_type, entity_id, performed_by, details
  ) VALUES (
    'flw_account_credit_atomic', 'account', _account_id, _user_id,
    jsonb_build_object(
      'amount', _amount, 'currency', _currency,
      'tx_ref', _tx_ref, 'transaction_id', v_tx_id,
      'new_balance', v_new_amount, 'source', _source
    )
  );

  RETURN jsonb_build_object(
    'status', 'credited',
    'transaction_id', v_tx_id,
    'balance_id', v_balance_id,
    'new_balance', v_new_amount,
    'credited', true
  );
END;
$function$;

-- Service-role only (called from edge functions)
REVOKE EXECUTE ON FUNCTION public.atomic_flw_account_credit(UUID,UUID,NUMERIC,TEXT,TEXT,UUID,TEXT,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_flw_account_credit(UUID,UUID,NUMERIC,TEXT,TEXT,UUID,TEXT,TEXT,JSONB) TO service_role;