-- Phase 1B-R1I-c.3D — Database-Atomic Round-Up Instruction Eligibility
-- LOCAL/TEST PENDING MIGRATION — NOT AUTO-APPLIED, NOT AUTHORISED FOR PRODUCTION.
--
-- Adds ONE trigger function and ONE BEFORE INSERT trigger on
-- public.roundup_transactions. Enforces, in a single database-serialised
-- statement:
--   * roundup_settings row for the inserting consumer must exist
--   * roundup_settings.enabled = true
--   * if NEW.goal_id IS NOT NULL:
--       * savings_goals row must exist
--       * savings_goals.consumer_id must match NEW.consumer_id
--       * savings_goals.status must NOT be 'archived'
--       * roundup_settings.default_goal_id must equal NEW.goal_id
--
-- Row-lock strategy (deterministic order — settings THEN goal):
--   * SELECT ... FROM public.roundup_settings ... FOR SHARE
--   * SELECT ... FROM public.savings_goals   ... FOR SHARE
-- FOR SHARE conflicts with the ROW EXCLUSIVE / FOR UPDATE lock taken by:
--   * UPDATE public.roundup_settings SET enabled=false ...
--   * UPDATE public.savings_goals   SET status='archived' ...
-- so the invariant is serialised against both disable and archive.
--
-- Additive only. NO destructive DDL. NO data modification. NO cascade
-- introduced. NO financial-history table is touched.
--
-- Rollback (LOCAL/TEST only) lives in the sibling .rollback.sql file.

BEGIN;

CREATE OR REPLACE FUNCTION public.roundup_instruction_eligibility_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_enabled        boolean;
  v_default_goal   uuid;
  v_goal_status    text;
  v_goal_consumer  uuid;
BEGIN
  -- 1. Lock the authoritative round-up configuration row for this consumer.
  --    Deterministic lock order: settings BEFORE goal.
  SELECT s.enabled, s.default_goal_id
    INTO v_enabled, v_default_goal
    FROM public.roundup_settings AS s
   WHERE s.consumer_id = NEW.consumer_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROUNDUP_INSTRUCTION_NOT_ALLOWED'
      USING ERRCODE   = '23514',
            CONSTRAINT = 'roundup_instruction_eligibility',
            DETAIL     = 'MISSING_ELIGIBILITY_RECORD',
            HINT       = 'roundup_settings row absent for inserting consumer';
  END IF;

  IF v_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'ROUNDUP_INSTRUCTION_NOT_ALLOWED'
      USING ERRCODE   = '23514',
            CONSTRAINT = 'roundup_instruction_eligibility',
            DETAIL     = 'ROUNDUP_DISABLED',
            HINT       = 'roundup_settings.enabled is not true';
  END IF;

  -- 2. Goal-scoped invariants only apply when the instruction references a goal.
  IF NEW.goal_id IS NOT NULL THEN
    IF v_default_goal IS NULL OR v_default_goal <> NEW.goal_id THEN
      RAISE EXCEPTION 'ROUNDUP_INSTRUCTION_NOT_ALLOWED'
        USING ERRCODE   = '23514',
              CONSTRAINT = 'roundup_instruction_eligibility',
              DETAIL     = 'INVALID_GOAL_SETTINGS_RELATION',
              HINT       = 'instruction goal_id does not match settings.default_goal_id';
    END IF;

    SELECT g.status, g.consumer_id
      INTO v_goal_status, v_goal_consumer
      FROM public.savings_goals AS g
     WHERE g.id = NEW.goal_id
     FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ROUNDUP_INSTRUCTION_NOT_ALLOWED'
        USING ERRCODE   = '23514',
              CONSTRAINT = 'roundup_instruction_eligibility',
              DETAIL     = 'MISSING_ELIGIBILITY_RECORD',
              HINT       = 'savings_goals row absent for referenced goal_id';
    END IF;

    IF v_goal_consumer IS DISTINCT FROM NEW.consumer_id THEN
      RAISE EXCEPTION 'ROUNDUP_INSTRUCTION_NOT_ALLOWED'
        USING ERRCODE   = '23514',
              CONSTRAINT = 'roundup_instruction_eligibility',
              DETAIL     = 'INVALID_GOAL_SETTINGS_RELATION',
              HINT       = 'savings_goals.consumer_id does not match instruction consumer_id';
    END IF;

    IF v_goal_status = 'archived' THEN
      RAISE EXCEPTION 'ROUNDUP_INSTRUCTION_NOT_ALLOWED'
        USING ERRCODE   = '23514',
              CONSTRAINT = 'roundup_instruction_eligibility',
              DETAIL     = 'GOAL_ARCHIVED',
              HINT       = 'savings_goals.status = archived';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.roundup_instruction_eligibility_trg() IS
  'Phase 1B-R1I-c.3D: BEFORE INSERT invariant for public.roundup_transactions. '
  'Serialises new-instruction admission against disable and archive via '
  'FOR SHARE row locks in order (roundup_settings, then savings_goals). '
  'Raises SQLSTATE 23514 with CONSTRAINT roundup_instruction_eligibility on '
  'MISSING_ELIGIBILITY_RECORD / ROUNDUP_DISABLED / GOAL_ARCHIVED / '
  'INVALID_GOAL_SETTINGS_RELATION. Owner-managed. search_path pinned. '
  'No dynamic SQL. No financial-history mutation.';

REVOKE ALL ON FUNCTION public.roundup_instruction_eligibility_trg() FROM PUBLIC;

-- Attach ONLY to INSERT. Updates (retry / settle / reconcile / Policy A
-- continuation) do not fire this trigger.
DROP TRIGGER IF EXISTS roundup_instruction_eligibility_before_insert
  ON public.roundup_transactions;

CREATE TRIGGER roundup_instruction_eligibility_before_insert
  BEFORE INSERT ON public.roundup_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.roundup_instruction_eligibility_trg();

COMMENT ON TRIGGER roundup_instruction_eligibility_before_insert
  ON public.roundup_transactions IS
  'Phase 1B-R1I-c.3D: fires only on INSERT. Rejects instructions when '
  'round-up is disabled, goal is archived, or the settings/goal '
  'relationship is missing or inconsistent. No effect on UPDATE.';

COMMIT;
