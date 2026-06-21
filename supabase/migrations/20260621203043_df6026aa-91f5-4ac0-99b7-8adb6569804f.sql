
CREATE TABLE IF NOT EXISTS public.promise_to_pay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loan_account_id uuid NOT NULL REFERENCES public.loan_accounts(id) ON DELETE CASCADE,
  promised_amount numeric(18,2) NOT NULL CHECK (promised_amount > 0),
  promised_date date NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  payment_method text NOT NULL DEFAULT 'pay_by_bank'
    CHECK (payment_method IN ('pay_by_bank','debit_card','bank_transfer','other')),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','partially_kept','kept','broken','cancelled','rescheduled')),
  kept_amount numeric(18,2) NOT NULL DEFAULT 0,
  kept_at timestamptz,
  broken_at timestamptz,
  reschedule_of uuid REFERENCES public.promise_to_pay(id),
  reason text,
  idempotency_key uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ptp_user ON public.promise_to_pay(user_id);
CREATE INDEX IF NOT EXISTS idx_ptp_loan ON public.promise_to_pay(loan_account_id);
CREATE INDEX IF NOT EXISTS idx_ptp_status_due ON public.promise_to_pay(status, promised_date);

GRANT SELECT, INSERT, UPDATE ON public.promise_to_pay TO authenticated;
GRANT ALL ON public.promise_to_pay TO service_role;

ALTER TABLE public.promise_to_pay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own promises"
  ON public.promise_to_pay FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own promises"
  ON public.promise_to_pay FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own promises"
  ON public.promise_to_pay FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_promise_to_pay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding numeric;
  v_penalty numeric;
  v_owner uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.promised_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'promised_date must be today or later';
    END IF;
    SELECT user_id, COALESCE(outstanding_balance,0), COALESCE(penalty_charges,0)
      INTO v_owner, v_outstanding, v_penalty
      FROM public.loan_accounts WHERE id = NEW.loan_account_id;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'loan_account not found';
    END IF;
    IF v_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'loan does not belong to user';
    END IF;
    IF NEW.promised_amount > (v_outstanding + v_penalty) THEN
      RAISE EXCEPTION 'promised_amount exceeds outstanding balance';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ptp ON public.promise_to_pay;
CREATE TRIGGER trg_validate_ptp
  BEFORE INSERT OR UPDATE ON public.promise_to_pay
  FOR EACH ROW EXECUTE FUNCTION public.validate_promise_to_pay();

CREATE TABLE IF NOT EXISTS public.promise_to_pay_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id uuid NOT NULL REFERENCES public.promise_to_pay(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('created','reminder_sent','payment_matched','kept','partial','broken','rescheduled','cancelled')),
  amount numeric(18,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ptp_events_promise ON public.promise_to_pay_events(promise_id);

GRANT SELECT, INSERT ON public.promise_to_pay_events TO authenticated;
GRANT ALL ON public.promise_to_pay_events TO service_role;

ALTER TABLE public.promise_to_pay_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own promise events"
  ON public.promise_to_pay_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.promise_to_pay p
             WHERE p.id = promise_to_pay_events.promise_id
               AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Users insert own promise events"
  ON public.promise_to_pay_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.promise_to_pay p
             WHERE p.id = promise_to_pay_events.promise_id
               AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- Scoring rules (generic schema: rule_key + weight)
INSERT INTO public.credit_scoring_rules (rule_key, weight, enabled)
VALUES
  ('ptp_kept',                 3,  true),
  ('ptp_partial',              1,  true),
  ('ptp_broken',             -25,  true),
  ('ptp_rescheduled',          0,  true),
  ('ptp_rescheduled_repeat',  -5,  true)
ON CONFLICT DO NOTHING;
