# Phase 1B-R1I-c.3D — Migration Artifact

**Canonical pending migration:**
`supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql`

**SHA-256:** `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e`

**Rollback (LOCAL/TEST only):**
`supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.rollback.sql`
**SHA-256:** `716eb01765942fce1e24897ee5b6414b1e2f3b750c181fe8507b87a4916f89ea`

**Packaging model:** B (pending-migrations directory; not auto-applied by Lovable Cloud).
**Existing budgeting migration checksum unchanged:** `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`.

## Migration content

Additive only. Contents limited to:

- `CREATE OR REPLACE FUNCTION public.roundup_instruction_eligibility_trg()` — SECURITY DEFINER, `SET search_path = public`, no dynamic SQL, schema-qualified references only.
- `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER roundup_instruction_eligibility_before_insert BEFORE INSERT ON public.roundup_transactions FOR EACH ROW EXECUTE FUNCTION ...`
- `COMMENT ON FUNCTION` and `COMMENT ON TRIGGER`.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC`.

No `CREATE TABLE`, no `ALTER TABLE`, no `CREATE INDEX`, no `GRANT`, no `DELETE`, no `TRUNCATE`, no `DROP TABLE`, no `DROP COLUMN`, no `ON DELETE CASCADE`, no financial-history UPDATE, no hard-coded identifiers.

## Reproducibility (local Postgres harness)

- Reset 1: PASS — apply against clean DB, schema hash `H1`.
- Reset 2: PASS — apply against clean DB, schema hash `H2 == H1`.
- Trigger inventory identical (`pg_trigger` count and OIDs match by name).
- Function hash identical (`pg_get_functiondef` result-byte identical).
- Applies cleanly against a pre-migration snapshot (idempotent — `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` sequence).

## Rollback

Rollback file removes only the trigger and function. Applied and re-applied under the same harness — schema returns to the pre-c.3D state. Not authorised for production execution.

## Promotion status

Promotion into `supabase/migrations/` remains **prohibited** until the Phase 1B production authorisation gate is opened. Same approver set as the existing pending README enumerates.
