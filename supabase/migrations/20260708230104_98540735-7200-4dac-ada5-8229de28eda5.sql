
-- ============ kang_config ============
CREATE TABLE IF NOT EXISTS public.kang_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kang_config TO authenticated;
GRANT ALL ON public.kang_config TO service_role;
ALTER TABLE public.kang_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read kang config"
  ON public.kang_config FOR SELECT TO authenticated USING (true);

INSERT INTO public.kang_config (key, value)
VALUES ('monthly_fee', jsonb_build_object('amount', 2000, 'currency', 'XAF'))
ON CONFLICT (key) DO NOTHING;

-- ============ kang_billing_logs ============
CREATE TABLE IF NOT EXISTS public.kang_billing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_reference UUID NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL CHECK (status IN ('success','failed')),
  reason TEXT,
  balance_before NUMERIC,
  balance_after NUMERIC,
  triggered_by TEXT NOT NULL DEFAULT 'user' CHECK (triggered_by IN ('user','cron')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kang_billing_logs_user ON public.kang_billing_logs(user_id, created_at DESC);
GRANT SELECT ON public.kang_billing_logs TO authenticated;
GRANT ALL ON public.kang_billing_logs TO service_role;
ALTER TABLE public.kang_billing_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own billing logs"
  ON public.kang_billing_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============ Atomic wallet debit RPC ============
CREATE OR REPLACE FUNCTION public.kang_debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_balance_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  -- Idempotency: if this reference already succeeded, replay
  IF EXISTS (SELECT 1 FROM public.kang_billing_logs WHERE payment_reference = p_reference AND status = 'success') THEN
    RETURN jsonb_build_object('success', true, 'replayed', true);
  END IF;

  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_wallet', 'current_balance', 0);
  END IF;

  -- Lock the balance row to prevent race conditions
  SELECT id, amount INTO v_balance_id, v_balance_before
  FROM public.account_balances
  WHERE account_id = v_account_id AND balance_type = 'ClosingAvailable'
  ORDER BY balance_datetime DESC
  LIMIT 1
  FOR UPDATE;

  IF v_balance_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_balance', 'current_balance', 0);
  END IF;

  IF v_balance_before < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_funds',
      'current_balance', v_balance_before,
      'required', p_amount
    );
  END IF;

  v_balance_after := v_balance_before - p_amount;

  UPDATE public.account_balances
     SET amount = v_balance_after,
         balance_datetime = now(),
         updated_at = now()
   WHERE id = v_balance_id;

  RETURN jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kang_debit_wallet(UUID, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kang_debit_wallet(UUID, NUMERIC, UUID) TO service_role;

-- updated_at trigger for kang_config
DROP TRIGGER IF EXISTS trg_kang_config_updated ON public.kang_config;
CREATE TRIGGER trg_kang_config_updated
BEFORE UPDATE ON public.kang_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
