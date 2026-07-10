
BEGIN;

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

DROP POLICY IF EXISTS "ledger_balances_admin_read"    ON public.ledger_account_balances;
DROP POLICY IF EXISTS "ledger_balances_service_write" ON public.ledger_account_balances;

CREATE POLICY "ledger_balances_admin_read"
  ON public.ledger_account_balances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ledger_balances_service_write"
  ON public.ledger_account_balances FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Materialization trigger
CREATE OR REPLACE FUNCTION public.materialize_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_normal CHAR(1);
  v_ccy    TEXT;
  v_delta  NUMERIC(20,4);
BEGIN
  SELECT normal_balance, currency INTO v_normal, v_ccy
  FROM public.ledger_accounts WHERE id = NEW.ledger_account_id;

  IF v_normal IS NULL THEN
    RAISE EXCEPTION 'ledger_account % has no normal_balance set', NEW.ledger_account_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_normal = 'D' THEN
    v_delta := COALESCE(NEW.debit,0) - COALESCE(NEW.credit,0);
  ELSE
    v_delta := COALESCE(NEW.credit,0) - COALESCE(NEW.debit,0);
  END IF;

  INSERT INTO public.ledger_account_balances AS lab
    (ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, updated_at)
  VALUES
    (NEW.ledger_account_id, v_ccy, v_delta,
     COALESCE(NEW.debit,0), COALESCE(NEW.credit,0), now(), now())
  ON CONFLICT (ledger_account_id, currency) DO UPDATE
     SET balance       = lab.balance      + EXCLUDED.balance,
         total_debit   = lab.total_debit  + EXCLUDED.total_debit,
         total_credit  = lab.total_credit + EXCLUDED.total_credit,
         last_entry_at = now(),
         updated_at    = now();

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_materialize_account_balance ON public.journal_lines;
CREATE TRIGGER trg_materialize_account_balance
  AFTER INSERT ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.materialize_account_balance();

-- Backfill (drop old signature first)
DROP FUNCTION IF EXISTS public.rebuild_ledger_account_balances();

CREATE FUNCTION public.rebuild_ledger_account_balances()
RETURNS TABLE(accounts_rebuilt INT, lines_processed BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_accounts INT := 0;
  v_lines    BIGINT := 0;
BEGIN
  DELETE FROM public.ledger_account_balances;

  INSERT INTO public.ledger_account_balances (ledger_account_id, currency, balance, total_debit, total_credit)
  SELECT id, currency, 0, 0, 0 FROM public.ledger_accounts WHERE is_active = true;
  GET DIAGNOSTICS v_accounts = ROW_COUNT;

  WITH agg AS (
    SELECT jl.ledger_account_id,
           la.currency,
           SUM(CASE WHEN la.normal_balance = 'D'
                    THEN COALESCE(jl.debit,0) - COALESCE(jl.credit,0)
                    ELSE COALESCE(jl.credit,0) - COALESCE(jl.debit,0)
               END) AS balance,
           SUM(COALESCE(jl.debit,0))  AS total_debit,
           SUM(COALESCE(jl.credit,0)) AS total_credit,
           MAX(jl.created_at)         AS last_entry_at
    FROM public.journal_lines jl
    JOIN public.ledger_accounts la ON la.id = jl.ledger_account_id
    GROUP BY jl.ledger_account_id, la.currency
  )
  INSERT INTO public.ledger_account_balances AS lab
    (ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, updated_at)
  SELECT ledger_account_id, currency, balance, total_debit, total_credit, last_entry_at, now()
  FROM agg
  ON CONFLICT (ledger_account_id, currency) DO UPDATE
     SET balance       = EXCLUDED.balance,
         total_debit   = EXCLUDED.total_debit,
         total_credit  = EXCLUDED.total_credit,
         last_entry_at = EXCLUDED.last_entry_at,
         updated_at    = now();

  SELECT COUNT(*) INTO v_lines FROM public.journal_lines;

  accounts_rebuilt := v_accounts;
  lines_processed  := v_lines;
  RETURN NEXT;
END;
$fn$;

REVOKE ALL ON FUNCTION public.rebuild_ledger_account_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_ledger_account_balances() TO service_role;

-- View
DROP VIEW IF EXISTS public.v_ledger_account_balances;
CREATE VIEW public.v_ledger_account_balances
WITH (security_invoker = true) AS
SELECT
  la.id            AS ledger_account_id,
  la.account_code,
  la.account_name,
  la.account_type,
  la.account_class,
  la.normal_balance,
  la.institution_id,
  COALESCE(lab.currency, la.currency)     AS currency,
  COALESCE(lab.balance, 0)                AS balance,
  COALESCE(lab.total_debit, 0)            AS total_debit,
  COALESCE(lab.total_credit, 0)           AS total_credit,
  lab.last_entry_at,
  COALESCE(lab.updated_at, la.updated_at) AS updated_at
FROM public.ledger_accounts la
LEFT JOIN public.ledger_account_balances lab
       ON lab.ledger_account_id = la.id;

GRANT SELECT ON public.v_ledger_account_balances TO authenticated;

COMMENT ON COLUMN public.ledger_accounts.balance IS
  'DEPRECATED: Use v_ledger_account_balances or ledger_account_balances. Maintained for backward compatibility only.';

COMMIT;

SELECT * FROM public.rebuild_ledger_account_balances();
