
-- Drop existing record_transaction_fee with old return type, then recreate
DROP FUNCTION IF EXISTS public.record_transaction_fee(uuid, text, text, numeric, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.record_transaction_fee(
  _institution_id uuid,
  _transaction_type text,
  _transaction_ref text,
  _transaction_amount numeric,
  _transaction_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fee_result jsonb;
  v_calculated_fee numeric;
  v_final_fee numeric;
BEGIN
  BEGIN
    v_fee_result := public.calculate_transaction_fee(_institution_id, _transaction_type, _transaction_amount);
    v_calculated_fee := (v_fee_result->>'calculated_fee')::numeric;
    v_final_fee := (v_fee_result->>'final_fee')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  IF v_calculated_fee <= 0 AND v_final_fee <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO transaction_fees (
    institution_id, transaction_type, transaction_ref,
    transaction_amount, transaction_date,
    fee_structure_id, fee_model,
    calculated_fee, waived_amount, final_fee,
    fee_breakdown, billing_status, metadata
  ) VALUES (
    _institution_id, _transaction_type, _transaction_ref,
    _transaction_amount, now(),
    (v_fee_result->>'fee_structure_id')::uuid, v_fee_result->>'fee_model',
    v_calculated_fee, COALESCE((v_fee_result->>'waived_amount')::numeric, 0), v_final_fee,
    v_fee_result, 'pending', _metadata
  );
END;
$$;
