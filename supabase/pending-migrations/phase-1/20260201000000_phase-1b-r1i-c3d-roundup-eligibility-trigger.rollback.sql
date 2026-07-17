-- Phase 1B-R1I-c.3D — Rollback (LOCAL/TEST ONLY)
-- Removes only the trigger and function introduced by
-- 20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql.
-- Not authorised for production execution.

BEGIN;

DROP TRIGGER IF EXISTS roundup_instruction_eligibility_before_insert
  ON public.roundup_transactions;

DROP FUNCTION IF EXISTS public.roundup_instruction_eligibility_trg();

COMMIT;
