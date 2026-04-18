-- Phase 23 — Consumer Cash Out hardening
-- F41: Atomic reversal RPC (avoids overwriting concurrent balance updates)
CREATE OR REPLACE FUNCTION public.atomic_consumer_withdrawal_reverse(
  _balance_id UUID,
  _reverse_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new NUMERIC;
BEGIN
  IF _reverse_amount IS NULL OR _reverse_amount <= 0 THEN
    RAISE EXCEPTION 'Reverse amount must be greater than zero';
  END IF;

  UPDATE public.account_balances
  SET amount = amount + _reverse_amount,
      balance_datetime = now(),
      updated_at = now()
  WHERE id = _balance_id
    AND credit_debit_indicator = 'Credit'
  RETURNING amount INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Balance not found for reversal';
  END IF;

  RETURN jsonb_build_object('success', true, 'new_amount', v_new, 'restored', _reverse_amount);
END;
$$;