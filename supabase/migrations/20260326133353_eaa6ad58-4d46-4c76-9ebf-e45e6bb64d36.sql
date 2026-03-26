CREATE OR REPLACE FUNCTION public.execute_atomic_transfer(
  _source_balance_id uuid,
  _dest_account_id uuid,
  _amount numeric,
  _currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_balance public.account_balances%ROWTYPE;
  v_dest_balance_id uuid;
  v_effective_currency text;
  v_source_new_amount numeric;
  v_dest_new_amount numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT *
  INTO v_source_balance
  FROM public.account_balances
  WHERE id = _source_balance_id
    AND credit_debit_indicator = 'Credit'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source balance not found';
  END IF;

  v_effective_currency := COALESCE(_currency, v_source_balance.currency);

  IF v_source_balance.currency <> v_effective_currency THEN
    RAISE EXCEPTION 'Currency mismatch';
  END IF;

  IF v_source_balance.amount < _amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  SELECT id
  INTO v_dest_balance_id
  FROM public.account_balances
  WHERE account_id = _dest_account_id
    AND credit_debit_indicator = 'Credit'
    AND currency = v_effective_currency
    AND balance_type IN ('ClosingAvailable', 'InterimAvailable')
  ORDER BY CASE WHEN balance_type = 'ClosingAvailable' THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;

  IF v_dest_balance_id IS NULL THEN
    INSERT INTO public.account_balances (
      account_id,
      amount,
      balance_datetime,
      balance_type,
      credit_debit_indicator,
      currency,
      created_at,
      updated_at
    ) VALUES (
      _dest_account_id,
      0,
      now(),
      'ClosingAvailable',
      'Credit',
      v_effective_currency,
      now(),
      now()
    )
    RETURNING id INTO v_dest_balance_id;
  END IF;

  UPDATE public.account_balances
  SET
    amount = amount - _amount,
    balance_datetime = now(),
    updated_at = now()
  WHERE id = _source_balance_id
  RETURNING amount INTO v_source_new_amount;

  UPDATE public.account_balances
  SET
    amount = amount + _amount,
    balance_datetime = now(),
    updated_at = now()
  WHERE id = v_dest_balance_id
  RETURNING amount INTO v_dest_new_amount;

  RETURN jsonb_build_object(
    'success', true,
    'source_balance_id', _source_balance_id,
    'destination_balance_id', v_dest_balance_id,
    'amount', _amount,
    'currency', v_effective_currency,
    'source_balance_after', v_source_new_amount,
    'destination_balance_after', v_dest_new_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_transfer_idempotency(
  _idempotency_key text,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx RECORD;
BEGIN
  SELECT
    t.id,
    t.amount,
    t.currency,
    t.status,
    t.merchant_details
  INTO v_tx
  FROM public.transactions t
  WHERE t.user_id = _user_id
    AND t.credit_debit_indicator = 'Debit'
    AND t.merchant_details IS NOT NULL
    AND t.merchant_details->>'idempotency_key' = _idempotency_key
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'transaction_id', v_tx.id,
    'transaction_reference', COALESCE(v_tx.merchant_details->>'transaction_ref', v_tx.id::text),
    'status', v_tx.status,
    'amount', v_tx.amount,
    'currency', v_tx.currency
  );
END;
$$;