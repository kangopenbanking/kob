
-- =====================================================================
-- BATCH 2: Materialized Ledger Balances (Midaz-style running totals)
-- =====================================================================
-- NOTE: We introduce a NEW table `public.ledger_account_balances` rather
-- than overloading `public.account_balances` (which stores wallet/customer
-- account balances and is consumed by AISP + Consumer reconciliation).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Task 2.1a: Materialized balances table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_account_balances (
    ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
    currency          TEXT NOT NULL,
    balance           NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_debit       NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_credit      NUMERIC(20,4) NOT NULL DEFAULT 0,
    last_entry_at     TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ledger_account_id, currency)
);

GRANT SELECT ON public.ledger_account_balances TO authenticated;
GRANT ALL    ON public.ledger_account_balances TO service_role;

ALTER TABLE public.ledger_account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view ledger balances" ON public.ledger_account_balances;
CREATE POLICY "Admins can view ledger balances"
    ON public.ledger_account_balances FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Institutions view own ledger balances" ON public.ledger_account_balances;
CREATE POLICY "Institutions view own ledger balances"
    ON public.ledger_account_balances FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ledger_accounts la
            WHERE la.id = ledger_account_balances.ledger_account_id
              AND la.institution_id IN (
                  SELECT institution_id FROM public.profiles WHERE id = auth.uid()
              )
        )
    );

-- ---------------------------------------------------------------------
-- Task 2.1b: Materialization trigger on journal_lines
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_normal_balance CHAR(1);
    v_currency       TEXT;
    v_delta          NUMERIC(20,4);
    v_entry_at       TIMESTAMPTZ;
BEGIN
    SELECT la.normal_balance, la.currency
      INTO v_normal_balance, v_currency
      FROM public.ledger_accounts la
     WHERE la.id = NEW.ledger_account_id;

    IF v_normal_balance IS NULL THEN
        RAISE EXCEPTION 'ledger_account % has no normal_balance defined', NEW.ledger_account_id;
    END IF;

    IF v_normal_balance = 'D' THEN
        v_delta := COALESCE(NEW.debit,0) - COALESCE(NEW.credit,0);
    ELSE
        v_delta := COALESCE(NEW.credit,0) - COALESCE(NEW.debit,0);
    END IF;

    SELECT je.created_at INTO v_entry_at
      FROM public.journal_entries je
     WHERE je.id = NEW.journal_entry_id;

    INSERT INTO public.ledger_account_balances AS lab
        (ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, updated_at)
    VALUES
        (NEW.ledger_account_id, v_currency, v_delta,
         COALESCE(NEW.debit,0), COALESCE(NEW.credit,0),
         v_entry_at, now())
    ON CONFLICT (ledger_account_id, currency) DO UPDATE
        SET balance       = lab.balance      + v_delta,
            total_debit   = lab.total_debit  + COALESCE(NEW.debit,0),
            total_credit  = lab.total_credit + COALESCE(NEW.credit,0),
            last_entry_at = GREATEST(COALESCE(lab.last_entry_at, 'epoch'::timestamptz), COALESCE(v_entry_at, now())),
            updated_at    = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_account_balance ON public.journal_lines;
CREATE TRIGGER trg_materialize_account_balance
AFTER INSERT ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.materialize_account_balance();

-- ---------------------------------------------------------------------
-- Task 2.2: Idempotent backfill function
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_ledger_account_balances()
RETURNS TABLE(rebuilt_accounts BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    -- Wipe existing calculated balances safely.
    DELETE FROM public.ledger_account_balances;

    -- Recompute from full journal history (excludes reversed entries).
    INSERT INTO public.ledger_account_balances
        (ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, updated_at)
    SELECT
        la.id,
        la.currency,
        COALESCE(SUM(
            CASE WHEN la.normal_balance = 'D'
                 THEN COALESCE(jl.debit,0) - COALESCE(jl.credit,0)
                 ELSE COALESCE(jl.credit,0) - COALESCE(jl.debit,0)
            END
        ), 0) AS balance,
        COALESCE(SUM(jl.debit),  0) AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit,
        MAX(je.created_at)          AS last_entry_at,
        now()
      FROM public.ledger_accounts la
      LEFT JOIN public.journal_lines   jl ON jl.ledger_account_id = la.id
      LEFT JOIN public.journal_entries je
             ON je.id = jl.journal_entry_id
            AND je.is_reversed = false
     GROUP BY la.id, la.currency, la.normal_balance;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;

-- Run backfill immediately so the table matches history.
SELECT public.rebuild_ledger_account_balances();

-- ---------------------------------------------------------------------
-- Task 2.3: Read-only view + deprecation comment
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ledger_account_balances AS
SELECT
    la.id                AS ledger_account_id,
    la.account_code,
    la.account_name,
    la.account_type,
    la.account_class,
    la.normal_balance,
    la.institution_id,
    la.is_active,
    COALESCE(lab.currency, la.currency)     AS currency,
    COALESCE(lab.balance, 0)                AS balance,
    COALESCE(lab.total_debit, 0)            AS total_debit,
    COALESCE(lab.total_credit, 0)           AS total_credit,
    lab.last_entry_at,
    COALESCE(lab.updated_at, la.updated_at) AS updated_at
FROM public.ledger_accounts la
LEFT JOIN public.ledger_account_balances lab
       ON lab.ledger_account_id = la.id
      AND lab.currency = la.currency;

GRANT SELECT ON public.v_ledger_account_balances TO authenticated, service_role;

COMMENT ON COLUMN public.ledger_accounts.balance IS
    'DEPRECATED: Use v_ledger_account_balances or ledger_account_balances. Maintained for backward compatibility only.';
