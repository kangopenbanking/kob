-- Phase 1B-R1I-c.3H — Savings-Goal Archive Lifecycle Provenance
-- LOCAL/TEST executable. Additive only. No DROP TABLE. No DROP COLUMN.
-- No TRUNCATE. No ON DELETE CASCADE introduced. No data deletion.
-- Prerequisite: c.1E (20260101000000) must have already added
--   savings_goals.archived_at and savings_goals.archived_by.

BEGIN;

-- 0. Fail-closed migration-order precondition.
DO $$
DECLARE
  has_at   boolean;
  has_by   boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='savings_goals'
                    AND column_name='archived_at')
    INTO has_at;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='savings_goals'
                    AND column_name='archived_by')
    INTO has_by;
  IF NOT (has_at AND has_by) THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE='c.3H migration-order error: prerequisite c.1E archival columns (archived_at, archived_by) are absent on public.savings_goals. Promote c.1E before c.3H.';
  END IF;
END $$;

-- 1. Backfill safety guard — reject if pre-existing archived rows lack
--    reconstructable prior-state evidence. This slice does NOT fabricate
--    archived_from_status; a human decision is required for backfill.
DO $$
DECLARE
  bad_rows bigint;
BEGIN
  SELECT COUNT(*) INTO bad_rows
    FROM public.savings_goals
   WHERE status = 'archived';
  IF bad_rows > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE=format('c.3H backfill decision required: %s pre-existing archived savings_goals rows have no reconstructable prior-state evidence. Do not fabricate archived_from_status.', bad_rows);
  END IF;
END $$;

-- 2. Additive column: archived_from_status.
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS archived_from_status text NULL;

COMMENT ON COLUMN public.savings_goals.archived_from_status IS
  'Immutable lifecycle predecessor captured at archive time. Backend-managed only. NULL for non-archived rows.';

-- 3. Lifecycle-integrity constraints.
-- 3a. Value domain: only the four approved prior states are allowed;
--     archived is explicitly forbidden as a predecessor.
ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_archived_from_status_domain;
ALTER TABLE public.savings_goals
  ADD  CONSTRAINT savings_goals_archived_from_status_domain
       CHECK (archived_from_status IS NULL
              OR archived_from_status IN ('active','paused','completed','cancelled'));

-- 3b. Provenance completeness: archived rows MUST carry full provenance;
--     non-archived rows MUST NOT carry archived_from_status.
ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_archive_provenance_complete;
ALTER TABLE public.savings_goals
  ADD  CONSTRAINT savings_goals_archive_provenance_complete
       CHECK (
         (status <> 'archived'
           AND archived_from_status IS NULL)
         OR
         (status = 'archived'
           AND archived_from_status IS NOT NULL
           AND archived_from_status <> 'archived'
           AND archived_at IS NOT NULL
           AND archived_by IS NOT NULL)
       );

-- 4. RLS hardening — extend c.1E policies so ordinary clients cannot
--    forge archived_from_status directly, and cannot reactivate an
--    archived row via UPDATE. Backend service_role continues to bypass
--    RLS for the atomic archival transition performed by the handler.
DROP POLICY IF EXISTS savings_goals_owner_insert ON public.savings_goals;
CREATE POLICY savings_goals_owner_insert ON public.savings_goals FOR INSERT TO authenticated
  WITH CHECK (consumer_id = auth.uid()
              AND status IN ('active','paused')
              AND archived_at IS NULL
              AND archived_by IS NULL
              AND archived_from_status IS NULL);

DROP POLICY IF EXISTS savings_goals_owner_update ON public.savings_goals;
CREATE POLICY savings_goals_owner_update ON public.savings_goals FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status <> 'archived')
  WITH CHECK (consumer_id = auth.uid()
              AND status <> 'archived'
              AND archived_at IS NULL
              AND archived_by IS NULL
              AND archived_from_status IS NULL);

COMMIT;
