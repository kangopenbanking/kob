-- G8: Atomic credit RPC for wallet crediting (mirrors atomic_debit_balance)
CREATE OR REPLACE FUNCTION public.atomic_credit_balance(_account_id uuid, _amount numeric, _currency text DEFAULT 'XAF')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    INSERT INTO public.account_balances (
      account_id, amount, balance_datetime, balance_type,
      credit_debit_indicator, currency
    ) VALUES (
      _account_id, _amount, now(), 'ClosingAvailable', 'Credit', _currency
    )
    RETURNING id, amount INTO v_balance;

    RETURN jsonb_build_object(
      'success', true,
      'balance_id', v_balance.id,
      'previous_amount', 0,
      'new_amount', v_balance.amount,
      'credited', _amount,
      'created', true
    );
  END IF;

  IF v_balance.currency <> _currency THEN
    RAISE EXCEPTION 'Currency mismatch. Wallet: %, Requested: %', v_balance.currency, _currency;
  END IF;

  UPDATE public.account_balances
  SET amount = amount + _amount,
      balance_datetime = now(),
      updated_at = now()
  WHERE id = v_balance.id
  RETURNING amount INTO v_new_amount;

  RETURN jsonb_build_object(
    'success', true,
    'balance_id', v_balance.id,
    'previous_amount', v_balance.amount,
    'new_amount', v_new_amount,
    'credited', _amount,
    'created', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.atomic_credit_balance(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_credit_balance(uuid, numeric, text) TO service_role;