
CREATE OR REPLACE FUNCTION public.atomic_debit_balance(
  _account_id uuid,
  _amount numeric,
  _currency text DEFAULT 'XAF'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance RECORD;
  v_new_amount numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT id, amount, currency
  INTO v_balance
  FROM public.account_balances
  WHERE account_id = _account_id
    AND balance_type = 'ClosingAvailable'
    AND credit_debit_indicator = 'Credit'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance not found for account';
  END IF;

  IF v_balance.amount < _amount THEN
    RAISE EXCEPTION 'Insufficient funds. Available: % %, Required: % %', v_balance.amount, v_balance.currency, _amount, _currency;
  END IF;

  UPDATE public.account_balances
  SET amount = amount - _amount,
      balance_datetime = now(),
      updated_at = now()
  WHERE id = v_balance.id
  RETURNING amount INTO v_new_amount;

  RETURN jsonb_build_object(
    'success', true,
    'balance_id', v_balance.id,
    'previous_amount', v_balance.amount,
    'new_amount', v_new_amount,
    'debited', _amount
  );
END;
$$;
