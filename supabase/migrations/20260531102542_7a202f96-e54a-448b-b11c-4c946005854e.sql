-- Statement download fee settings (singleton) and per-charge audit + RPC

CREATE TABLE IF NOT EXISTS public.statement_fee_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  fee_amount numeric(15,2) NOT NULL DEFAULT 500,
  currency text NOT NULL DEFAULT 'XAF',
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.statement_fee_settings TO anon, authenticated;
GRANT ALL ON public.statement_fee_settings TO service_role;

ALTER TABLE public.statement_fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "statement_fee_settings_read_all"
  ON public.statement_fee_settings FOR SELECT
  USING (true);

CREATE POLICY "statement_fee_settings_admin_write"
  ON public.statement_fee_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.statement_fee_settings (id, fee_amount, currency, is_enabled)
VALUES (true, 500, 'XAF', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.statement_fee_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  source text NOT NULL,
  serial text,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'charged',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.statement_fee_charges TO authenticated;
GRANT ALL ON public.statement_fee_charges TO service_role;

ALTER TABLE public.statement_fee_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "statement_fee_charges_owner_or_admin_read"
  ON public.statement_fee_charges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_statement_fee_charges_user
  ON public.statement_fee_charges (user_id, created_at DESC);

-- Atomic charge function. Debits the latest ClosingAvailable/ClosingBooked balance
-- and writes a transaction + charge record. Returns a JSON outcome.
CREATE OR REPLACE FUNCTION public.charge_statement_fee(
  p_user_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_currency text,
  p_source text,
  p_serial text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest public.account_balances%ROWTYPE;
  v_new_amount numeric(15,2);
  v_institution_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('status', 'skipped');
  END IF;

  SELECT institution_id INTO v_institution_id
  FROM public.accounts
  WHERE id = p_account_id;

  SELECT * INTO v_latest
  FROM public.account_balances
  WHERE account_id = p_account_id
    AND balance_type IN ('ClosingAvailable', 'ClosingBooked')
  ORDER BY balance_datetime DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.statement_fee_charges (user_id, account_id, source, serial, amount, currency, status, metadata)
    VALUES (p_user_id, p_account_id, p_source, p_serial, p_amount, p_currency, 'failed',
            jsonb_build_object('reason', 'no_balance'));
    RETURN jsonb_build_object('status', 'no_balance');
  END IF;

  IF v_latest.credit_debit_indicator = 'Credit' THEN
    v_new_amount := v_latest.amount - p_amount;
    IF v_new_amount < 0 THEN
      INSERT INTO public.statement_fee_charges (user_id, account_id, source, serial, amount, currency, status, metadata)
      VALUES (p_user_id, p_account_id, p_source, p_serial, p_amount, p_currency, 'failed',
              jsonb_build_object('reason', 'insufficient_funds', 'available', v_latest.amount));
      RETURN jsonb_build_object('status', 'insufficient_funds', 'available', v_latest.amount);
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
      jsonb_build_object('kind', 'statement_fee', 'source', p_source, 'serial', p_serial)
    );
  END IF;

  INSERT INTO public.statement_fee_charges (user_id, account_id, source, serial, amount, currency, status, metadata)
  VALUES (p_user_id, p_account_id, p_source, p_serial, p_amount, p_currency, 'charged',
          jsonb_build_object('new_balance', v_new_amount));

  RETURN jsonb_build_object('status', 'charged', 'amount', p_amount, 'currency', p_currency, 'new_balance', v_new_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.charge_statement_fee(uuid, uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_statement_fee(uuid, uuid, numeric, text, text, text) TO service_role;