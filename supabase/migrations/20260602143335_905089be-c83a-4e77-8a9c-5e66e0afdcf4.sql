
-- 1) Payout reference fields on earnings (used by Driver Payout History screen)
ALTER TABLE public.ddn_driver_earnings
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ddn_earnings_driver_status ON public.ddn_driver_earnings(driver_id, status, settled_at DESC);

-- 2) Delivery code resend audit + rate-limit log
CREATE TABLE IF NOT EXISTS public.ddn_code_resend_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.ddn_assignments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.ddn_drivers(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL,
  reason text,
  previous_code_hash text,
  new_code_hash text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ddn_code_resend_log TO authenticated;
GRANT ALL ON public.ddn_code_resend_log TO service_role;

ALTER TABLE public.ddn_code_resend_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ddn_code_resend driver read own"
  ON public.ddn_code_resend_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ddn_drivers d
    WHERE d.id = ddn_code_resend_log.driver_id AND d.user_id = auth.uid()
  ) OR requested_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ddn_code_resend_assignment ON public.ddn_code_resend_log(assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ddn_code_resend_driver_time ON public.ddn_code_resend_log(driver_id, created_at DESC);

-- 3) Server-side state-machine validator for DDN assignments
CREATE OR REPLACE FUNCTION public.ddn_validate_transition(_from text, _to text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _from = _to THEN true -- idempotent replays
    WHEN _from = 'pending'    AND _to IN ('offered','assignment_failed','cancelled') THEN true
    WHEN _from = 'offered'    AND _to IN ('accepted','pending','assignment_failed','cancelled') THEN true
    WHEN _from = 'accepted'   AND _to IN ('picked_up','cancelled') THEN true
    WHEN _from = 'picked_up'  AND _to IN ('on_the_way','cancelled') THEN true
    WHEN _from = 'on_the_way' AND _to IN ('arriving','delivered','cancelled') THEN true
    WHEN _from = 'arriving'   AND _to IN ('delivered','cancelled') THEN true
    ELSE false
  END;
$$;
