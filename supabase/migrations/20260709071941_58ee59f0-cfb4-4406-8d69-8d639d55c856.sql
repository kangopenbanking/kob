
-- ============================================================
-- BATCH 1: Ledger Immutability & Double-Entry Invariants
-- ============================================================

-- ── 1.1 & 1.2  Immutability triggers ────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_journal_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Journal entries and lines are immutable. Use reversals instead.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_immutable
  BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_immutable();

DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON public.journal_lines;
CREATE TRIGGER trg_journal_lines_immutable
  BEFORE UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_immutable();

-- ── 1.3  Deferred double-entry balance constraint ───────────
CREATE OR REPLACE FUNCTION public.enforce_double_entry_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
  v_debit    NUMERIC;
  v_credit   NUMERIC;
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_debit, v_credit
    FROM public.journal_lines
   WHERE journal_entry_id = v_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Double-entry constraint violated: SUM(debit) must equal SUM(credit) for journal_entry_id %', v_entry_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS enforce_double_entry_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER enforce_double_entry_balance
  AFTER INSERT OR UPDATE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_double_entry_balance();

-- ── 1.4  Chart of Accounts enhancements ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_account_class') THEN
    CREATE TYPE public.ledger_account_class AS ENUM (
      'ASSET','LIABILITY','EQUITY','INCOME','EXPENSE','CONTRA_ASSET','CONTRA_LIABILITY'
    );
  END IF;
END$$;

ALTER TABLE public.ledger_accounts
  ADD COLUMN IF NOT EXISTS account_class  public.ledger_account_class,
  ADD COLUMN IF NOT EXISTS normal_balance CHAR(1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_accounts_normal_balance_chk'
  ) THEN
    ALTER TABLE public.ledger_accounts
      ADD CONSTRAINT ledger_accounts_normal_balance_chk
      CHECK (normal_balance IN ('D','C'));
  END IF;
END$$;

-- Backfill from existing text account_type
UPDATE public.ledger_accounts
   SET account_class = CASE
         WHEN account_type ILIKE '%contra%asset%'     THEN 'CONTRA_ASSET'::public.ledger_account_class
         WHEN account_type ILIKE '%contra%liab%'      THEN 'CONTRA_LIABILITY'::public.ledger_account_class
         WHEN account_type ILIKE '%asset%'            THEN 'ASSET'::public.ledger_account_class
         WHEN account_type ILIKE '%liab%'             THEN 'LIABILITY'::public.ledger_account_class
         WHEN account_type ILIKE '%equity%'           THEN 'EQUITY'::public.ledger_account_class
         WHEN account_type ILIKE '%revenue%'
           OR account_type ILIKE '%income%'           THEN 'INCOME'::public.ledger_account_class
         WHEN account_type ILIKE '%expense%'          THEN 'EXPENSE'::public.ledger_account_class
         ELSE 'ASSET'::public.ledger_account_class
       END,
       normal_balance = CASE
         WHEN account_type ILIKE '%contra%asset%'     THEN 'C'
         WHEN account_type ILIKE '%contra%liab%'      THEN 'D'
         WHEN account_type ILIKE '%asset%'            THEN 'D'
         WHEN account_type ILIKE '%expense%'          THEN 'D'
         WHEN account_type ILIKE '%liab%'             THEN 'C'
         WHEN account_type ILIKE '%equity%'           THEN 'C'
         WHEN account_type ILIKE '%revenue%'
           OR account_type ILIKE '%income%'           THEN 'C'
         ELSE 'D'
       END
 WHERE account_class IS NULL OR normal_balance IS NULL;

ALTER TABLE public.ledger_accounts
  ALTER COLUMN account_class  SET NOT NULL,
  ALTER COLUMN normal_balance SET NOT NULL;

-- ── 1.5  Fiscal Period Control ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_lookup
  ON public.fiscal_periods (institution_id, status, period_start, period_end);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_periods TO authenticated;
GRANT ALL ON public.fiscal_periods TO service_role;

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage fiscal periods" ON public.fiscal_periods;
CREATE POLICY "Admins manage fiscal periods"
  ON public.fiscal_periods
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read fiscal periods" ON public.fiscal_periods;
CREATE POLICY "Authenticated read fiscal periods"
  ON public.fiscal_periods
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.update_fiscal_periods_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_fiscal_periods_updated_at ON public.fiscal_periods;
CREATE TRIGGER trg_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_periods_updated_at();

-- Fiscal period enforcement on journal_entries
CREATE OR REPLACE FUNCTION public.check_fiscal_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_count INT;
BEGIN
  -- Global (non-institution) entries are not fiscal-period gated
  IF NEW.institution_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_open_count
    FROM public.fiscal_periods
   WHERE institution_id = NEW.institution_id
     AND status = 'OPEN'
     AND NEW.entry_date BETWEEN period_start AND period_end;

  IF v_open_count = 0 THEN
    RAISE EXCEPTION 'Cannot post journal entry to a closed or non-existent fiscal period.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_fiscal_period ON public.journal_entries;
CREATE TRIGGER check_fiscal_period
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_fiscal_period();
