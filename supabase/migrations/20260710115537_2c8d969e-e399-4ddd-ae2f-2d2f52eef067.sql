
-- =====================================================================
-- BATCH 6 — Auditor-grade Reporting Views (read-only)
-- All views are security_invoker so RLS on base tables is preserved.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. General Ledger view (every posted line, enriched)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_general_ledger CASCADE;
CREATE VIEW public.v_general_ledger
WITH (security_invoker = true) AS
SELECT
  jl.id                    AS line_id,
  je.id                    AS entry_id,
  je.entry_number,
  je.entry_date,
  je.description,
  je.reference_type,
  je.reference_id,
  je.institution_id,
  je.is_reversed,
  je.reversal_of,
  je.idempotency_key,
  je.posted_by,
  je.created_at            AS entry_created_at,
  la.id                    AS ledger_account_id,
  la.account_code,
  la.account_name,
  la.account_type,
  la.account_class,
  la.normal_balance,
  la.currency,
  jl.debit,
  jl.credit,
  jl.description           AS line_description
FROM public.journal_lines jl
JOIN public.journal_entries je ON je.id = jl.journal_entry_id
JOIN public.ledger_accounts la ON la.id = jl.ledger_account_id;

COMMENT ON VIEW public.v_general_ledger IS
  'Batch 6: Auditor general ledger. One row per posted journal line, joined to entry + account.';

-- ---------------------------------------------------------------------
-- 2. Journal entries summary (debit/credit totals + balanced flag)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_journal_entries_summary CASCADE;
CREATE VIEW public.v_journal_entries_summary
WITH (security_invoker = true) AS
SELECT
  je.id,
  je.entry_number,
  je.entry_date,
  je.description,
  je.reference_type,
  je.reference_id,
  je.institution_id,
  je.is_reversed,
  je.reversal_of,
  je.idempotency_key,
  je.posted_by,
  je.created_at,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  COUNT(jl.id)                AS line_count,
  (COALESCE(SUM(jl.debit),0) = COALESCE(SUM(jl.credit),0)) AS is_balanced
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
GROUP BY je.id;

COMMENT ON VIEW public.v_journal_entries_summary IS
  'Batch 6: One row per journal entry with total debit/credit and balanced flag.';

-- ---------------------------------------------------------------------
-- 3. Unbalanced entries safeguard (should always be empty)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_unbalanced_entries CASCADE;
CREATE VIEW public.v_unbalanced_entries
WITH (security_invoker = true) AS
SELECT *
FROM public.v_journal_entries_summary
WHERE NOT is_balanced;

COMMENT ON VIEW public.v_unbalanced_entries IS
  'Batch 6: Safeguard. Lists any journal entry where debits ≠ credits. Expected to be empty.';

-- ---------------------------------------------------------------------
-- 4. Reversal pairs (original ↔ reversal traceability)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_journal_reversal_pairs CASCADE;
CREATE VIEW public.v_journal_reversal_pairs
WITH (security_invoker = true) AS
SELECT
  orig.id                AS original_entry_id,
  orig.entry_number      AS original_entry_number,
  orig.entry_date        AS original_entry_date,
  orig.description       AS original_description,
  orig.institution_id,
  rev.id                 AS reversal_entry_id,
  rev.entry_number       AS reversal_entry_number,
  rev.entry_date         AS reversal_entry_date,
  rev.description        AS reversal_description,
  rev.created_at         AS reversed_at
FROM public.journal_entries orig
JOIN public.journal_entries rev ON rev.reversal_of = orig.id;

COMMENT ON VIEW public.v_journal_reversal_pairs IS
  'Batch 6: Original journal entries paired with their reversal entries.';

-- ---------------------------------------------------------------------
-- 5. Account activity summary
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_account_activity CASCADE;
CREATE VIEW public.v_account_activity
WITH (security_invoker = true) AS
SELECT
  la.id                       AS ledger_account_id,
  la.account_code,
  la.account_name,
  la.account_type,
  la.account_class,
  la.normal_balance,
  la.currency,
  la.institution_id,
  COUNT(jl.id)                AS posting_count,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE la.normal_balance
    WHEN 'D' THEN COALESCE(SUM(jl.debit),0)  - COALESCE(SUM(jl.credit),0)
    WHEN 'C' THEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
  END                         AS net_balance,
  MIN(je.entry_date)          AS first_posting_date,
  MAX(je.entry_date)          AS last_posting_date
FROM public.ledger_accounts la
LEFT JOIN public.journal_lines   jl ON jl.ledger_account_id = la.id
LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id
GROUP BY la.id;

COMMENT ON VIEW public.v_account_activity IS
  'Batch 6: Per-account posting counts, debit/credit totals, and net balance (normal-side aware).';

-- ---------------------------------------------------------------------
-- 6. Trial balance view (current, normal-side aware)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_trial_balance CASCADE;
CREATE VIEW public.v_trial_balance
WITH (security_invoker = true) AS
SELECT
  la.id                       AS ledger_account_id,
  la.account_code,
  la.account_name,
  la.account_type,
  la.account_class,
  la.normal_balance,
  la.currency,
  la.institution_id,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE la.normal_balance
    WHEN 'D' THEN GREATEST(COALESCE(SUM(jl.debit),0)  - COALESCE(SUM(jl.credit),0), 0)
    WHEN 'C' THEN 0
  END                         AS debit_balance,
  CASE la.normal_balance
    WHEN 'C' THEN GREATEST(COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0), 0)
    WHEN 'D' THEN 0
  END                         AS credit_balance
FROM public.ledger_accounts la
LEFT JOIN public.journal_lines   jl ON jl.ledger_account_id = la.id
LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id
WHERE la.is_active
GROUP BY la.id;

COMMENT ON VIEW public.v_trial_balance IS
  'Batch 6: Current trial balance. Debit-normal accounts show net in debit_balance, credit-normal in credit_balance.';

-- ---------------------------------------------------------------------
-- 7. Trial balance as-of function
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trial_balance(
  p_as_of         date    DEFAULT CURRENT_DATE,
  p_institution   uuid    DEFAULT NULL
)
RETURNS TABLE (
  ledger_account_id uuid,
  account_code      text,
  account_name      text,
  account_type      text,
  account_class     ledger_account_class,
  normal_balance    char(1),
  currency          text,
  institution_id    uuid,
  total_debit       numeric,
  total_credit      numeric,
  debit_balance     numeric,
  credit_balance    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    la.id,
    la.account_code,
    la.account_name,
    la.account_type,
    la.account_class,
    la.normal_balance,
    la.currency,
    la.institution_id,
    COALESCE(SUM(jl.debit), 0)  AS total_debit,
    COALESCE(SUM(jl.credit), 0) AS total_credit,
    CASE la.normal_balance
      WHEN 'D' THEN GREATEST(COALESCE(SUM(jl.debit),0)  - COALESCE(SUM(jl.credit),0), 0)
      ELSE 0
    END AS debit_balance,
    CASE la.normal_balance
      WHEN 'C' THEN GREATEST(COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0), 0)
      ELSE 0
    END AS credit_balance
  FROM public.ledger_accounts la
  LEFT JOIN public.journal_lines   jl ON jl.ledger_account_id = la.id
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    AND je.entry_date <= p_as_of
    AND (p_institution IS NULL OR je.institution_id = p_institution)
  WHERE la.is_active
    AND (p_institution IS NULL OR la.institution_id = p_institution OR la.institution_id IS NULL)
  GROUP BY la.id;
$$;

COMMENT ON FUNCTION public.fn_trial_balance(date, uuid) IS
  'Batch 6: Trial balance as of any date, optionally scoped to an institution.';

-- ---------------------------------------------------------------------
-- 8. Balance Sheet as-of function
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_balance_sheet(
  p_as_of         date DEFAULT CURRENT_DATE,
  p_institution   uuid DEFAULT NULL
)
RETURNS TABLE (
  section         text,
  account_code    text,
  account_name    text,
  currency        text,
  balance         numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tb AS (
    SELECT * FROM public.fn_trial_balance(p_as_of, p_institution)
  )
  SELECT
    CASE account_class::text
      WHEN 'asset'     THEN 'ASSET'
      WHEN 'liability' THEN 'LIABILITY'
      WHEN 'equity'    THEN 'EQUITY'
    END AS section,
    account_code,
    account_name,
    currency,
    CASE normal_balance
      WHEN 'D' THEN debit_balance - credit_balance
      WHEN 'C' THEN credit_balance - debit_balance
    END AS balance
  FROM tb
  WHERE account_class::text IN ('asset','liability','equity')
  ORDER BY section, account_code;
$$;

COMMENT ON FUNCTION public.fn_balance_sheet(date, uuid) IS
  'Batch 6: Balance sheet lines (assets, liabilities, equity) as of a given date.';

-- ---------------------------------------------------------------------
-- 9. Income Statement function (date range)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_income_statement(
  p_from          date,
  p_to            date,
  p_institution   uuid DEFAULT NULL
)
RETURNS TABLE (
  section         text,
  account_code    text,
  account_name    text,
  currency        text,
  amount          numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE la.account_class::text
      WHEN 'revenue' THEN 'REVENUE'
      WHEN 'expense' THEN 'EXPENSE'
    END AS section,
    la.account_code,
    la.account_name,
    la.currency,
    CASE la.normal_balance
      WHEN 'C' THEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
      WHEN 'D' THEN COALESCE(SUM(jl.debit),0)  - COALESCE(SUM(jl.credit),0)
    END AS amount
  FROM public.ledger_accounts la
  LEFT JOIN public.journal_lines   jl ON jl.ledger_account_id = la.id
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    AND je.entry_date BETWEEN p_from AND p_to
    AND (p_institution IS NULL OR je.institution_id = p_institution)
  WHERE la.account_class::text IN ('revenue','expense')
    AND la.is_active
    AND (p_institution IS NULL OR la.institution_id = p_institution OR la.institution_id IS NULL)
  GROUP BY la.id
  ORDER BY section, la.account_code;
$$;

COMMENT ON FUNCTION public.fn_income_statement(date, date, uuid) IS
  'Batch 6: Income statement (revenue vs. expense) over a date range, optionally scoped to an institution.';

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
GRANT SELECT ON public.v_general_ledger            TO authenticated, service_role;
GRANT SELECT ON public.v_journal_entries_summary   TO authenticated, service_role;
GRANT SELECT ON public.v_unbalanced_entries        TO authenticated, service_role;
GRANT SELECT ON public.v_journal_reversal_pairs    TO authenticated, service_role;
GRANT SELECT ON public.v_account_activity          TO authenticated, service_role;
GRANT SELECT ON public.v_trial_balance             TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.fn_trial_balance(date, uuid)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_balance_sheet(date, uuid)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_income_statement(date, date, uuid)    TO authenticated, service_role;
