-- Phase 3a: payout_schedules table for auto-withdrawal rules
CREATE TABLE public.payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL DEFAULT 'consumer',
  owner_id UUID NOT NULL,
  destination_id UUID NOT NULL,
  destination_type TEXT NOT NULL DEFAULT 'consumer',
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_config JSONB NOT NULL DEFAULT '{}',
  amount_mode TEXT NOT NULL DEFAULT 'sweep_all',
  amount_value NUMERIC DEFAULT 0,
  min_balance_to_keep NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add validation trigger instead of CHECK constraints for flexibility
CREATE OR REPLACE FUNCTION public.validate_payout_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_type NOT IN ('consumer', 'merchant') THEN
    RAISE EXCEPTION 'owner_type must be consumer or merchant';
  END IF;
  IF NEW.schedule_type NOT IN ('daily', 'weekly', 'monthly', 'threshold') THEN
    RAISE EXCEPTION 'schedule_type must be daily, weekly, monthly, or threshold';
  END IF;
  IF NEW.amount_mode NOT IN ('fixed', 'sweep_all', 'percentage') THEN
    RAISE EXCEPTION 'amount_mode must be fixed, sweep_all, or percentage';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payout_schedule
  BEFORE INSERT OR UPDATE ON public.payout_schedules
  FOR EACH ROW EXECUTE FUNCTION public.validate_payout_schedule();

-- RLS
ALTER TABLE public.payout_schedules ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own rules
CREATE POLICY "Users can manage own payout schedules"
  ON public.payout_schedules
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Service role full access for cron
CREATE POLICY "Service role full access on payout_schedules"
  ON public.payout_schedules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Phase 2b: Atomic consumer withdrawal debit function
CREATE OR REPLACE FUNCTION public.atomic_consumer_withdrawal_debit(
  _balance_id UUID,
  _debit_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_amount NUMERIC;
  v_new_amount NUMERIC;
BEGIN
  -- Row-level lock to prevent race conditions
  SELECT amount INTO v_current_amount
  FROM public.account_balances
  WHERE id = _balance_id
  FOR UPDATE;

  IF v_current_amount IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'balance_not_found');
  END IF;

  IF v_current_amount < _debit_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'available', v_current_amount,
      'required', _debit_amount
    );
  END IF;

  v_new_amount := v_current_amount - _debit_amount;

  UPDATE public.account_balances
  SET amount = v_new_amount,
      balance_datetime = now()
  WHERE id = _balance_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_amount', v_current_amount,
    'new_amount', v_new_amount,
    'debited', _debit_amount
  );
END;
$$;
