
-- Enum + columns on ledger_accounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_account_class') THEN
    CREATE TYPE public.ledger_account_class AS ENUM
      ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE','CONTRA_ASSET','CONTRA_LIABILITY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ledger_accounts' AND column_name='account_class') THEN
    ALTER TABLE public.ledger_accounts ADD COLUMN account_class public.ledger_account_class;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ledger_accounts' AND column_name='normal_balance') THEN
    ALTER TABLE public.ledger_accounts ADD COLUMN normal_balance CHAR(1);
  END IF;
END $$;

UPDATE public.ledger_accounts
SET account_class = COALESCE(account_class,
  CASE upper(account_type)
    WHEN 'ASSET' THEN 'ASSET'::public.ledger_account_class
    WHEN 'EXPENSE' THEN 'EXPENSE'::public.ledger_account_class
    WHEN 'LIABILITY' THEN 'LIABILITY'::public.ledger_account_class
    WHEN 'EQUITY' THEN 'EQUITY'::public.ledger_account_class
    WHEN 'REVENUE' THEN 'INCOME'::public.ledger_account_class
    WHEN 'INCOME' THEN 'INCOME'::public.ledger_account_class
    ELSE account_class END),
  normal_balance = COALESCE(normal_balance,
  CASE upper(account_type)
    WHEN 'ASSET' THEN 'D' WHEN 'EXPENSE' THEN 'D' WHEN 'CONTRA_LIABILITY' THEN 'D'
    WHEN 'LIABILITY' THEN 'C' WHEN 'EQUITY' THEN 'C' WHEN 'REVENUE' THEN 'C'
    WHEN 'INCOME' THEN 'C' WHEN 'CONTRA_ASSET' THEN 'C'
    ELSE normal_balance END)
WHERE account_class IS NULL OR normal_balance IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_accounts_normal_balance_chk') THEN
    ALTER TABLE public.ledger_accounts
      ADD CONSTRAINT ledger_accounts_normal_balance_chk CHECK (normal_balance IN ('D','C'));
  END IF;
END $$;

-- Journal immutability
CREATE OR REPLACE FUNCTION public.enforce_journal_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  RAISE EXCEPTION 'Posted journal records are immutable (table=%, op=%). Post a compensating reversal entry instead.', TG_TABLE_NAME, TG_OP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_journal_entries_immutable_upd ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_journal_entries_immutable_del ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_journal_lines_immutable_upd ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_journal_lines_immutable_del ON public.journal_lines;

CREATE TRIGGER trg_journal_entries_immutable_upd BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW WHEN (OLD.is_reversed IS NOT DISTINCT FROM NEW.is_reversed
    AND OLD.reversal_of IS NOT DISTINCT FROM NEW.reversal_of)
  EXECUTE FUNCTION public.enforce_journal_immutable();
CREATE TRIGGER trg_journal_entries_immutable_del BEFORE DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_immutable();
CREATE TRIGGER trg_journal_lines_immutable_upd BEFORE UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_immutable();
CREATE TRIGGER trg_journal_lines_immutable_del BEFORE DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_immutable();

-- Double entry balance
CREATE OR REPLACE FUNCTION public.enforce_double_entry_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_entry_id UUID; v_diff NUMERIC;
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF v_entry_id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0) INTO v_diff
  FROM public.journal_lines WHERE journal_entry_id = v_entry_id;
  IF v_diff <> 0 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced (debit - credit = %)', v_entry_id, v_diff;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_journal_lines_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_lines_balance AFTER INSERT ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_double_entry_balance();

-- Fiscal periods
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by UUID, closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_periods_unique_range
  ON public.fiscal_periods (COALESCE(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start, period_end);

GRANT SELECT ON public.fiscal_periods TO authenticated;
GRANT ALL ON public.fiscal_periods TO service_role;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fiscal periods readable by authenticated" ON public.fiscal_periods;
CREATE POLICY "Fiscal periods readable by authenticated" ON public.fiscal_periods
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Fiscal periods manageable by admins" ON public.fiscal_periods;
CREATE POLICY "Fiscal periods manageable by admins" ON public.fiscal_periods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.enforce_fiscal_period_open()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_closed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_periods fp
    WHERE NEW.entry_date BETWEEN fp.period_start AND fp.period_end
      AND (fp.institution_id = NEW.institution_id OR fp.institution_id IS NULL)
      AND fp.status = 'closed'
  ) INTO v_closed;
  IF v_closed THEN
    RAISE EXCEPTION 'Cannot post to a closed fiscal period (entry_date=%)', NEW.entry_date;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_journal_entries_fiscal_guard ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_fiscal_guard BEFORE INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_fiscal_period_open();

-- ledger_account_balances: create if missing, otherwise ensure required columns exist
CREATE TABLE IF NOT EXISTS public.ledger_account_balances (
  ledger_account_id UUID PRIMARY KEY REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  currency TEXT,
  balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_debit NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_credit NUMERIC(20,4) NOT NULL DEFAULT 0,
  last_entry_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_account_balances' AND column_name='balance') THEN
    ALTER TABLE public.ledger_account_balances ADD COLUMN balance NUMERIC(20,4) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_account_balances' AND column_name='total_debit') THEN
    ALTER TABLE public.ledger_account_balances ADD COLUMN total_debit NUMERIC(20,4) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_account_balances' AND column_name='total_credit') THEN
    ALTER TABLE public.ledger_account_balances ADD COLUMN total_credit NUMERIC(20,4) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_account_balances' AND column_name='last_entry_at') THEN
    ALTER TABLE public.ledger_account_balances ADD COLUMN last_entry_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_account_balances' AND column_name='currency') THEN
    ALTER TABLE public.ledger_account_balances ADD COLUMN currency TEXT;
  END IF;
END $$;

GRANT SELECT ON public.ledger_account_balances TO authenticated;
GRANT ALL ON public.ledger_account_balances TO service_role;
ALTER TABLE public.ledger_account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ledger balances readable by authenticated" ON public.ledger_account_balances;
CREATE POLICY "Ledger balances readable by authenticated" ON public.ledger_account_balances
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Ledger balances managed by admins" ON public.ledger_account_balances;
CREATE POLICY "Ledger balances managed by admins" ON public.ledger_account_balances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Materialisation trigger
CREATE OR REPLACE FUNCTION public.materialize_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_nb CHAR(1); v_ccy TEXT; v_delta NUMERIC;
BEGIN
  SELECT normal_balance, currency INTO v_nb, v_ccy
  FROM public.ledger_accounts WHERE id = NEW.ledger_account_id;
  v_delta := CASE WHEN v_nb='C'
    THEN COALESCE(NEW.credit,0) - COALESCE(NEW.debit,0)
    ELSE COALESCE(NEW.debit,0)  - COALESCE(NEW.credit,0) END;

  INSERT INTO public.ledger_account_balances
    (ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, updated_at)
  VALUES (NEW.ledger_account_id, v_ccy, v_delta,
    COALESCE(NEW.debit,0), COALESCE(NEW.credit,0), now(), now())
  ON CONFLICT (ledger_account_id) DO UPDATE
  SET balance = public.ledger_account_balances.balance + v_delta,
      total_debit = public.ledger_account_balances.total_debit + COALESCE(NEW.debit,0),
      total_credit = public.ledger_account_balances.total_credit + COALESCE(NEW.credit,0),
      last_entry_at = now(),
      updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_materialize_account_balance ON public.journal_lines;
CREATE TRIGGER trg_materialize_account_balance AFTER INSERT ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.materialize_account_balance();

-- Rebuild function (drop first to allow return-type change)
DROP FUNCTION IF EXISTS public.rebuild_ledger_account_balances();
CREATE FUNCTION public.rebuild_ledger_account_balances()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_count INTEGER;
BEGIN
  DELETE FROM public.ledger_account_balances;
  INSERT INTO public.ledger_account_balances
    (ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, updated_at)
  SELECT la.id, la.currency,
    CASE WHEN la.normal_balance='C'
         THEN COALESCE(SUM(jl.credit),0)-COALESCE(SUM(jl.debit),0)
         ELSE COALESCE(SUM(jl.debit),0) -COALESCE(SUM(jl.credit),0) END,
    COALESCE(SUM(jl.debit),0), COALESCE(SUM(jl.credit),0),
    MAX(jl.created_at), now()
  FROM public.ledger_accounts la
  LEFT JOIN public.journal_lines jl ON jl.ledger_account_id = la.id
  GROUP BY la.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- Reporting view
DROP VIEW IF EXISTS public.v_ledger_account_balances;
CREATE VIEW public.v_ledger_account_balances WITH (security_invoker = true) AS
SELECT la.id AS ledger_account_id, la.account_code, la.account_name,
  la.account_class, la.normal_balance, la.institution_id, la.currency,
  COALESCE(b.total_debit, 0) AS total_debit,
  COALESCE(b.total_credit, 0) AS total_credit,
  COALESCE(b.balance, 0) AS balance,
  b.last_entry_at,
  COALESCE(b.updated_at, la.updated_at) AS updated_at
FROM public.ledger_accounts la
LEFT JOIN public.ledger_account_balances b ON b.ledger_account_id = la.id;

GRANT SELECT ON public.v_ledger_account_balances TO authenticated;

COMMENT ON COLUMN public.ledger_accounts.balance IS 'DEPRECATED: use v_ledger_account_balances.balance (materialised)';
