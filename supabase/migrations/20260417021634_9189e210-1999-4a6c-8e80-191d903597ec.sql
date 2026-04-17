
CREATE OR REPLACE FUNCTION public.calculate_transaction_fee(
  _institution_id uuid,
  _transaction_type text,
  _transaction_amount numeric,
  _transaction_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fee_structure RECORD;
  v_calculated_fee NUMERIC := 0;
  v_fixed_component NUMERIC := 0;
  v_percentage_component NUMERIC := 0;
  v_tier JSONB;
  v_waiver_id uuid := NULL;
  v_waiver_type text := NULL;
  v_waiver RECORD;
  v_waived_amount NUMERIC := 0;
  v_final_fee NUMERIC := 0;
BEGIN
  SELECT * INTO v_fee_structure
  FROM fee_structures
  WHERE transaction_type = _transaction_type
    AND is_active = true
    AND effective_from <= _transaction_date
    AND (effective_until IS NULL OR effective_until >= _transaction_date)
    AND (
      (_institution_id IS NOT NULL AND fee_scope = 'institution' AND institution_id = _institution_id)
      OR fee_scope = 'platform'
    )
  ORDER BY
    CASE WHEN fee_scope = 'institution' AND institution_id = _institution_id THEN 0 ELSE 1 END,
    effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'fee_structure_id', NULL, 'fee_model', NULL,
      'transaction_amount', _transaction_amount,
      'fixed_component', 0, 'percentage_component', 0, 'percentage_rate', 0,
      'calculated_fee', 0, 'waiver_id', NULL, 'waiver_type', NULL,
      'waived_amount', 0, 'final_fee', 0, 'reason', 'no_active_structure'
    );
  END IF;

  CASE v_fee_structure.fee_model
    WHEN 'fixed' THEN
      v_calculated_fee := COALESCE(v_fee_structure.fixed_amount, 0);
      v_fixed_component := v_calculated_fee;
    WHEN 'percentage' THEN
      v_percentage_component := (_transaction_amount * COALESCE(v_fee_structure.percentage_rate, 0) / 100);
      IF v_fee_structure.min_fee_amount IS NOT NULL AND v_percentage_component < v_fee_structure.min_fee_amount THEN
        v_percentage_component := v_fee_structure.min_fee_amount;
      END IF;
      IF v_fee_structure.max_fee_amount IS NOT NULL AND v_percentage_component > v_fee_structure.max_fee_amount THEN
        v_percentage_component := v_fee_structure.max_fee_amount;
      END IF;
      v_calculated_fee := v_percentage_component;
    WHEN 'hybrid' THEN
      v_fixed_component := COALESCE(v_fee_structure.fixed_amount, 0);
      v_percentage_component := (_transaction_amount * COALESCE(v_fee_structure.percentage_rate, 0) / 100);
      IF v_fee_structure.min_fee_amount IS NOT NULL AND (v_fixed_component + v_percentage_component) < v_fee_structure.min_fee_amount THEN
        v_percentage_component := v_fee_structure.min_fee_amount - v_fixed_component;
      END IF;
      IF v_fee_structure.max_fee_amount IS NOT NULL AND (v_fixed_component + v_percentage_component) > v_fee_structure.max_fee_amount THEN
        v_percentage_component := v_fee_structure.max_fee_amount - v_fixed_component;
      END IF;
      v_calculated_fee := v_fixed_component + v_percentage_component;
    WHEN 'tiered' THEN
      IF v_fee_structure.tiered_rates IS NOT NULL THEN
        FOR v_tier IN SELECT * FROM jsonb_array_elements(v_fee_structure.tiered_rates) LOOP
          IF _transaction_amount >= COALESCE((v_tier->>'min')::NUMERIC, 0)
             AND ((v_tier->>'max') IS NULL OR _transaction_amount < (v_tier->>'max')::NUMERIC) THEN
            v_fixed_component := COALESCE((v_tier->>'fixed')::NUMERIC, 0);
            v_percentage_component := COALESCE(_transaction_amount * (v_tier->>'percentage')::NUMERIC / 100, 0);
            v_calculated_fee := v_fixed_component + v_percentage_component;
            EXIT;
          END IF;
        END LOOP;
      END IF;
  END CASE;

  IF v_fee_structure.max_charge_cap IS NOT NULL AND v_fee_structure.max_charge_cap > 0
     AND v_calculated_fee > v_fee_structure.max_charge_cap THEN
    v_calculated_fee := v_fee_structure.max_charge_cap;
  END IF;

  IF _institution_id IS NOT NULL THEN
    SELECT * INTO v_waiver
    FROM fee_waivers
    WHERE institution_id = _institution_id
      AND is_active = true
      AND effective_from <= _transaction_date
      AND effective_until >= _transaction_date
      AND (max_uses IS NULL OR current_uses < max_uses)
      AND (applies_to_transaction_types IS NULL OR _transaction_type = ANY(applies_to_transaction_types))
    ORDER BY effective_from DESC
    LIMIT 1;

    IF FOUND THEN
      v_waiver_id := v_waiver.id;
      v_waiver_type := v_waiver.waiver_type;
      CASE v_waiver.waiver_type
        WHEN 'percentage_discount' THEN v_waived_amount := v_calculated_fee * v_waiver.discount_percentage / 100;
        WHEN 'fixed_discount'      THEN v_waived_amount := LEAST(v_waiver.discount_fixed_amount, v_calculated_fee);
        WHEN 'full_waiver'         THEN v_waived_amount := v_calculated_fee;
        WHEN 'promotional'         THEN v_waived_amount := v_calculated_fee * v_waiver.discount_percentage / 100;
        ELSE v_waived_amount := 0;
      END CASE;
      UPDATE fee_waivers SET current_uses = current_uses + 1 WHERE id = v_waiver.id;
    END IF;
  END IF;

  v_final_fee := GREATEST(v_calculated_fee - v_waived_amount, 0);

  RETURN jsonb_build_object(
    'fee_structure_id', v_fee_structure.id,
    'fee_scope', v_fee_structure.fee_scope,
    'fee_model', v_fee_structure.fee_model,
    'transaction_amount', _transaction_amount,
    'fixed_component', v_fixed_component,
    'percentage_component', v_percentage_component,
    'percentage_rate', v_fee_structure.percentage_rate,
    'calculated_fee', v_calculated_fee,
    'waiver_id', v_waiver_id,
    'waiver_type', v_waiver_type,
    'waived_amount', v_waived_amount,
    'final_fee', v_final_fee
  );
END;
$function$;
