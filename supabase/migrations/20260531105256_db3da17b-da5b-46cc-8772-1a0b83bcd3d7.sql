CREATE OR REPLACE FUNCTION public.resolve_statement_fee(
  p_source text,
  p_institution_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.statement_fee_overrides%ROWTYPE;
  v_global public.statement_fee_settings%ROWTYPE;
  v_fs RECORD;
  v_tx_type text;
BEGIN
  -- 1) Most specific: app + institution_type override
  IF p_institution_type IS NOT NULL THEN
    SELECT * INTO v_row FROM public.statement_fee_overrides
     WHERE source = p_source AND institution_type = p_institution_type AND is_active = true
     ORDER BY updated_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'amount', v_row.amount,
        'currency', v_row.currency,
        'is_enabled', v_row.is_enabled,
        'source', 'override_app_institution'
      );
    END IF;
  END IF;

  -- 2) App-level override
  SELECT * INTO v_row FROM public.statement_fee_overrides
   WHERE source = p_source AND institution_type IS NULL AND is_active = true
   ORDER BY updated_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'amount', v_row.amount,
      'currency', v_row.currency,
      'is_enabled', v_row.is_enabled,
      'source', 'override_app'
    );
  END IF;

  -- 3) Unified Fee Management (fee_structures) — platform scope
  v_tx_type := CASE
    WHEN p_source = 'banking' THEN 'statement_download_banking'
    ELSE 'statement_download_consumer'
  END;
  SELECT fixed_amount, percentage_rate, fee_model
    INTO v_fs
    FROM public.fee_structures
   WHERE transaction_type = v_tx_type
     AND fee_scope = 'platform'
     AND is_active = true
     AND effective_from <= CURRENT_DATE
     AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
   ORDER BY effective_from DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'amount', COALESCE(v_fs.fixed_amount, 0),
      'currency', 'XAF',
      'is_enabled', COALESCE(v_fs.fixed_amount, 0) > 0,
      'source', 'fee_structures'
    );
  END IF;

  -- 4) Global singleton
  SELECT * INTO v_global FROM public.statement_fee_settings WHERE id = true LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'amount', v_global.amount,
      'currency', v_global.currency,
      'is_enabled', v_global.is_enabled,
      'source', 'global'
    );
  END IF;

  RETURN jsonb_build_object('amount', 500, 'currency', 'XAF', 'is_enabled', true, 'source', 'default');
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_statement_fee(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_statement_fee(text, text) TO authenticated, service_role;