-- Statement fee per-app/per-institution overrides + idempotent charging

-- 1) Idempotency key for charges (prevents double-deduction on repeated clicks)
ALTER TABLE public.statement_fee_charges
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS statement_fee_charges_idem_key_uniq
  ON public.statement_fee_charges (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) Per-app / per-institution-type fee overrides table
CREATE TABLE IF NOT EXISTS public.statement_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_source text NOT NULL CHECK (app_source IN ('customer','banking')),
  institution_type text,
  fee_amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  is_enabled boolean NOT NULL DEFAULT true,
  is_free boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_source, institution_type)
);

GRANT SELECT ON public.statement_fee_overrides TO anon, authenticated;
GRANT ALL ON public.statement_fee_overrides TO service_role;

ALTER TABLE public.statement_fee_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stmt_fee_overrides_read_all"
  ON public.statement_fee_overrides FOR SELECT
  USING (true);

CREATE POLICY "stmt_fee_overrides_admin_write"
  ON public.statement_fee_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Resolver: pick most-specific fee config for (source, institution_type)
CREATE OR REPLACE FUNCTION public.resolve_statement_fee(
  p_source text,
  p_institution_type text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.statement_fee_overrides%ROWTYPE;
  v_global public.statement_fee_settings%ROWTYPE;
BEGIN
  -- Most specific: app + institution_type
  IF p_institution_type IS NOT NULL THEN
    SELECT * INTO v_row FROM public.statement_fee_overrides
      WHERE app_source = p_source AND institution_type = p_institution_type
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'fee_amount', CASE WHEN v_row.is_free THEN 0 ELSE v_row.fee_amount END,
        'currency', v_row.currency,
        'is_enabled', v_row.is_enabled AND NOT v_row.is_free,
        'is_free', v_row.is_free,
        'source', 'override_app_type'
      );
    END IF;
  END IF;

  -- App-level override (institution_type IS NULL)
  SELECT * INTO v_row FROM public.statement_fee_overrides
    WHERE app_source = p_source AND institution_type IS NULL
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'fee_amount', CASE WHEN v_row.is_free THEN 0 ELSE v_row.fee_amount END,
      'currency', v_row.currency,
      'is_enabled', v_row.is_enabled AND NOT v_row.is_free,
      'is_free', v_row.is_free,
      'source', 'override_app'
    );
  END IF;

  -- Fallback to global singleton
  SELECT * INTO v_global FROM public.statement_fee_settings WHERE id = true LIMIT 1;
  RETURN jsonb_build_object(
    'fee_amount', COALESCE(v_global.fee_amount, 0),
    'currency', COALESCE(v_global.currency, 'XAF'),
    'is_enabled', COALESCE(v_global.is_enabled, false),
    'is_free', NOT COALESCE(v_global.is_enabled, false) OR COALESCE(v_global.fee_amount, 0) = 0,
    'source', 'global'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_statement_fee(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_statement_fee(text, text) TO authenticated, service_role;

-- 4) Idempotent charge: replace charge function with new signature accepting idempotency key
CREATE OR REPLACE FUNCTION public.charge_statement_fee_v2(
  p_user_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_currency text,
  p_source text,
  p_serial text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest public.account_balances%ROWTYPE;
  v_new_amount numeric(15,2);
  v_institution_id uuid;
  v_existing public.statement_fee_charges%ROWTYPE;
BEGIN
  -- Idempotency check: return prior outcome verbatim
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.statement_fee_charges
      WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', v_existing.status,
        'replay', true,
        'amount', v_existing.amount,
        'currency', v_existing.currency,
        'serial', v_existing.serial
      );
    END IF;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('status', 'skipped');
  END IF;

  SELECT institution_id INTO v_institution_id FROM public.accounts WHERE id = p_account_id;

  SELECT * INTO v_latest FROM public.account_balances
    WHERE account_id = p_account_id
      AND balance_type IN ('ClosingAvailable', 'ClosingBooked')
    ORDER BY balance_datetime DESC
    LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.statement_fee_charges (user_id, account_id, source, serial, amount, currency, status, idempotency_key, metadata)
    VALUES (p_user_id, p_account_id, p_source, p_serial, p_amount, p_currency, 'failed', p_idempotency_key,
            jsonb_build_object('reason', 'no_balance'));
    RETURN jsonb_build_object('status', 'no_balance');
  END IF;

  IF v_latest.credit_debit_indicator = 'Credit' THEN
    v_new_amount := v_latest.amount - p_amount;
    IF v_new_amount < 0 THEN
      INSERT INTO public.statement_fee_charges (user_id, account_id, source, serial, amount, currency, status, idempotency_key, metadata)
      VALUES (p_user_id, p_account_id, p_source, p_serial, p_amount, p_currency, 'failed', p_idempotency_key,
              jsonb_build_object('reason', 'insufficient_funds', 'available', v_latest.amount));
      RETURN jsonb_build_object('status', 'insufficient_funds', 'available', v_latest.amount, 'currency', v_latest.currency);
    END IF;
  ELSE
    v_new_amount := v_latest.amount + p_amount;
  END IF;

  INSERT INTO public.account_balances (
    account_id, balance_type, credit_debit_indicator, amount, currency, balance_datetime
  ) VALUES (
    p_account_id, v_latest.balance_type, v_latest.credit_debit_indicator,
    v_new_amount, v_latest.currency, now()
  );

  IF v_institution_id IS NOT NULL THEN
    INSERT INTO public.transactions (
      institution_id, transaction_type, amount, currency, status, account_id, user_id,
      booking_datetime, value_datetime, credit_debit_indicator, transaction_information, metadata
    ) VALUES (
      v_institution_id, 'fee', p_amount, p_currency, 'completed', p_account_id, p_user_id,
      now(), now(), 'Debit',
      'Statement download fee' || CASE WHEN p_serial IS NOT NULL THEN ' ' || p_serial ELSE '' END,
      jsonb_build_object('kind', 'statement_fee', 'source', p_source, 'serial', p_serial, 'idempotency_key', p_idempotency_key)
    );
  END IF;

  INSERT INTO public.statement_fee_charges (user_id, account_id, source, serial, amount, currency, status, idempotency_key, metadata)
  VALUES (p_user_id, p_account_id, p_source, p_serial, p_amount, p_currency, 'charged', p_idempotency_key,
          jsonb_build_object('new_balance', v_new_amount));

  RETURN jsonb_build_object('status', 'charged', 'amount', p_amount, 'currency', p_currency, 'new_balance', v_new_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.charge_statement_fee_v2(uuid, uuid, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_statement_fee_v2(uuid, uuid, numeric, text, text, text, text) TO service_role;