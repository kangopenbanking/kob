-- Phase 27: Recurring Payments — Salary income & P2P (Kang user) support
-- Adds payment_type, recipient identifiers, last_run tracking, and execution metadata.

ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'bill',
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS source_account_id uuid,
  ADD COLUMN IF NOT EXISTS destination_account_id uuid,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_status text,
  ADD COLUMN IF NOT EXISTS last_run_error text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Validate payment_type values via trigger (avoids CHECK immutability issues)
CREATE OR REPLACE FUNCTION public.validate_recurring_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_type NOT IN ('bill', 'salary', 'p2p') THEN
    RAISE EXCEPTION 'payment_type must be bill, salary, or p2p';
  END IF;
  IF NEW.payment_type = 'p2p' AND NEW.recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'recipient_user_id is required for p2p recurring payments';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_recurring_payment ON public.recurring_payments;
CREATE TRIGGER trg_validate_recurring_payment
  BEFORE INSERT OR UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_payment();

CREATE INDEX IF NOT EXISTS idx_recurring_payments_due
  ON public.recurring_payments (next_payment_date)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_payments_recipient
  ON public.recurring_payments (recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;