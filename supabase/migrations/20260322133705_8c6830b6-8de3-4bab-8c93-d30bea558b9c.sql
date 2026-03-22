
-- Phase 3B: Ledger posting refs for cross-domain idempotent tracking
CREATE TABLE IF NOT EXISTS public.ledger_posting_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  idempotency_key TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  domain TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_type, reference_id, domain)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ledger_posting_refs_lookup 
  ON public.ledger_posting_refs(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_posting_refs_journal 
  ON public.ledger_posting_refs(journal_entry_id);

-- RLS: admin + service_role only
ALTER TABLE public.ledger_posting_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read ledger_posting_refs"
  ON public.ledger_posting_refs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to ledger_posting_refs"
  ON public.ledger_posting_refs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ledger integrity check function (admin-only)
CREATE OR REPLACE FUNCTION public.check_ledger_integrity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_entries INT;
  v_unbalanced_entries INT;
  v_orphan_lines INT;
  v_negative_balance_accounts INT;
  v_duplicate_postings INT;
  v_result JSONB;
BEGIN
  -- Count total journal entries
  SELECT COUNT(*) INTO v_total_entries FROM journal_entries;
  
  -- Find unbalanced entries (debits != credits)
  SELECT COUNT(*) INTO v_unbalanced_entries
  FROM (
    SELECT je.id,
      COALESCE(SUM(jl.debit), 0) AS total_debit,
      COALESCE(SUM(jl.credit), 0) AS total_credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.id
    HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) > 0.001
  ) unbalanced;
  
  -- Find orphan journal lines (no parent entry)
  SELECT COUNT(*) INTO v_orphan_lines
  FROM journal_lines jl
  LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE je.id IS NULL;
  
  -- Count entries with single line (should have >=2)
  SELECT COUNT(*) INTO v_negative_balance_accounts
  FROM (
    SELECT je.id, COUNT(jl.id) AS line_count
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.id
    HAVING COUNT(jl.id) < 2
  ) single_line;
  
  -- Check for duplicate posting refs
  SELECT COUNT(*) INTO v_duplicate_postings
  FROM (
    SELECT reference_type, reference_id, domain, COUNT(*) AS cnt
    FROM ledger_posting_refs
    GROUP BY reference_type, reference_id, domain
    HAVING COUNT(*) > 1
  ) dupes;
  
  v_result := jsonb_build_object(
    'timestamp', now(),
    'total_journal_entries', v_total_entries,
    'unbalanced_entries', v_unbalanced_entries,
    'orphan_lines', v_orphan_lines,
    'single_line_entries', v_negative_balance_accounts,
    'duplicate_posting_refs', v_duplicate_postings,
    'integrity_pass', (v_unbalanced_entries = 0 AND v_orphan_lines = 0 AND v_duplicate_postings = 0),
    'checks', jsonb_build_array(
      jsonb_build_object('check', 'balanced_entries', 'pass', v_unbalanced_entries = 0, 'failures', v_unbalanced_entries),
      jsonb_build_object('check', 'no_orphan_lines', 'pass', v_orphan_lines = 0, 'failures', v_orphan_lines),
      jsonb_build_object('check', 'min_two_lines', 'pass', v_negative_balance_accounts = 0, 'failures', v_negative_balance_accounts),
      jsonb_build_object('check', 'no_duplicate_postings', 'pass', v_duplicate_postings = 0, 'failures', v_duplicate_postings)
    )
  );
  
  RETURN v_result;
END;
$$;
