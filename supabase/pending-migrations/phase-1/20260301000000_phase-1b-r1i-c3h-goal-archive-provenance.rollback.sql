-- Phase 1B-R1I-c.3H — ROLLBACK (LOCAL/TEST ONLY)
--
-- WARNING: This rollback removes the archived_from_status column and its
-- lifecycle-integrity constraints. If archival data has already been
-- written after c.3H applied, dropping the column WILL cause immutable
-- provenance loss. Prefer forward-fix once any archived_from_status row
-- exists. This rollback is NOT authorised against production.

BEGIN;

DO $$
DECLARE
  populated bigint;
BEGIN
  SELECT COUNT(*) INTO populated
    FROM public.savings_goals
   WHERE archived_from_status IS NOT NULL;
  IF populated > 0 THEN
    RAISE WARNING 'c.3H rollback: % savings_goals rows carry archived_from_status. Rolling back will destroy provenance. Consider forward-fix instead.', populated;
  END IF;
END $$;

-- Restore c.1E policies verbatim (no archived_from_status clause).
DROP POLICY IF EXISTS savings_goals_owner_insert ON public.savings_goals;
CREATE POLICY savings_goals_owner_insert ON public.savings_goals FOR INSERT TO authenticated
  WITH CHECK (consumer_id = auth.uid()
              AND status IN ('active','paused')
              AND archived_at IS NULL
              AND archived_by IS NULL);

DROP POLICY IF EXISTS savings_goals_owner_update ON public.savings_goals;
CREATE POLICY savings_goals_owner_update ON public.savings_goals FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status <> 'archived')
  WITH CHECK (consumer_id = auth.uid()
              AND status <> 'archived'
              AND archived_at IS NULL
              AND archived_by IS NULL);

ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_archive_provenance_complete;
ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_archived_from_status_domain;

ALTER TABLE public.savings_goals
  DROP COLUMN IF EXISTS archived_from_status;

-- c.1E and c.3D objects are intentionally left intact.
-- Financial history (roundup_transactions, roundup_events, payments,
-- ledger, settlements, reconciliation, regulatory_reports) is untouched.

COMMIT;
