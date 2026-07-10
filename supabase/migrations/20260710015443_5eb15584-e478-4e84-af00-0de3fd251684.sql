
BEGIN;

-- =========================================================
-- 1. IDEMPOTENCY KEY on journal_entries
-- =========================================================
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entries_idem
  ON public.journal_entries (institution_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =========================================================
-- 2. REVERSAL INTEGRITY
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_journal_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.journal_entries%ROWTYPE;
BEGIN
  IF NEW.reversal_of IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_target FROM public.journal_entries WHERE id = NEW.reversal_of FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reversal_of references unknown journal entry %', NEW.reversal_of
      USING ERRCODE = '23503';
  END IF;

  IF v_target.is_reversed THEN
    RAISE EXCEPTION 'journal entry % is already reversed', NEW.reversal_of
      USING ERRCODE = '23505';
  END IF;

  IF NEW.id = NEW.reversal_of THEN
    RAISE EXCEPTION 'journal entry cannot reverse itself'
      USING ERRCODE = '23514';
  END IF;

  -- Flag the target as reversed (bypasses immutability trigger via SECURITY DEFINER path)
  UPDATE public.journal_entries
     SET is_reversed = true
   WHERE id = NEW.reversal_of AND is_reversed = false;

  RETURN NEW;
END;
$$;

-- Allow the reversal trigger's UPDATE to bypass immutability by tagging via session
-- Simpler: relax immutability trigger to allow toggling is_reversed false -> true only.
CREATE OR REPLACE FUNCTION public.enforce_journal_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'journal_entries are immutable: DELETE forbidden'
      USING ERRCODE = '42501';
  END IF;

  -- Allow ONLY the is_reversed flag to flip false -> true; everything else frozen.
  IF (OLD.is_reversed = false AND NEW.is_reversed = true)
     AND NEW.id = OLD.id
     AND NEW.entry_number IS NOT DISTINCT FROM OLD.entry_number
     AND NEW.entry_date IS NOT DISTINCT FROM OLD.entry_date
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.reference_type IS NOT DISTINCT FROM OLD.reference_type
     AND NEW.reference_id IS NOT DISTINCT FROM OLD.reference_id
     AND NEW.institution_id IS NOT DISTINCT FROM OLD.institution_id
     AND NEW.reversal_of IS NOT DISTINCT FROM OLD.reversal_of
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'journal_entries are immutable: UPDATE forbidden (only is_reversed flag may be set true)'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_reversal ON public.journal_entries;
CREATE TRIGGER trg_journal_reversal
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_reversal();

-- =========================================================
-- 3. LOAN APPLICATION STATE MACHINE
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_loan_application_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  ok := CASE OLD.status::text
    WHEN 'draft'        THEN NEW.status::text IN ('submitted','rejected')
    WHEN 'submitted'    THEN NEW.status::text IN ('under_review','approved','rejected')
    WHEN 'under_review' THEN NEW.status::text IN ('approved','rejected')
    WHEN 'approved'     THEN NEW.status::text IN ('disbursed','rejected')
    WHEN 'disbursed'    THEN NEW.status::text IN ('active')
    WHEN 'active'       THEN NEW.status::text IN ('completed','defaulted','written_off')
    WHEN 'defaulted'    THEN NEW.status::text IN ('active','written_off','completed')
    ELSE false
  END;

  IF NOT ok THEN
    RAISE EXCEPTION 'illegal loan_applications status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_application_transition ON public.loan_applications;
CREATE TRIGGER trg_loan_application_transition
  BEFORE UPDATE OF status ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_application_transition();

-- =========================================================
-- 4. LOAN ACCOUNT STATE MACHINE
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_loan_account_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  ok := CASE OLD.status::text
    WHEN 'approved'  THEN NEW.status::text IN ('disbursed','rejected')
    WHEN 'disbursed' THEN NEW.status::text IN ('active','defaulted')
    WHEN 'active'    THEN NEW.status::text IN ('completed','defaulted','written_off')
    WHEN 'defaulted' THEN NEW.status::text IN ('active','written_off','completed')
    ELSE false
  END;

  IF NOT ok THEN
    RAISE EXCEPTION 'illegal loan_accounts status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_account_transition ON public.loan_accounts;
CREATE TRIGGER trg_loan_account_transition
  BEFORE UPDATE OF status ON public.loan_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_account_transition();

-- =========================================================
-- 5. LOAN SCHEDULE INSTALLMENT STATE MACHINE
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_loan_schedule_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  ok := CASE OLD.status
    WHEN 'pending'  THEN NEW.status IN ('partial','paid','overdue','waived')
    WHEN 'partial'  THEN NEW.status IN ('paid','overdue','waived')
    WHEN 'overdue'  THEN NEW.status IN ('partial','paid','waived','written_off')
    ELSE false
  END;

  IF NOT ok THEN
    RAISE EXCEPTION 'illegal loan_schedule status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_schedule_transition ON public.loan_schedule;
CREATE TRIGGER trg_loan_schedule_transition
  BEFORE UPDATE OF status ON public.loan_schedule
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_schedule_transition();

-- =========================================================
-- 6. SAVINGS ACCOUNT STATE MACHINE
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_savings_account_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  ok := CASE OLD.status
    WHEN 'active'  THEN NEW.status IN ('frozen','matured','closed','dormant')
    WHEN 'frozen'  THEN NEW.status IN ('active','closed')
    WHEN 'dormant' THEN NEW.status IN ('active','closed')
    WHEN 'matured' THEN NEW.status IN ('closed','active')
    ELSE false
  END;

  IF NOT ok THEN
    RAISE EXCEPTION 'illegal savings_accounts status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_savings_account_transition ON public.savings_accounts;
CREATE TRIGGER trg_savings_account_transition
  BEFORE UPDATE OF status ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_savings_account_transition();

COMMIT;
