# Pending Migrations — Phase 1

**DO NOT MOVE FILES OUT OF THIS DIRECTORY WITHOUT DATABASE OWNER + RELEASE MANAGER APPROVAL.**

This directory holds migrations that have been proven under local/test PostgreSQL
harnesses but are **not** authorised for production application.

Files here are **not** auto-applied by Lovable Cloud. Only files under
`supabase/migrations/` are auto-applied to Test on save and promoted to Live on
publish. Anything under `supabase/pending-migrations/` is inert to the platform.

## Contents

| File | Purpose | SHA-256 |
|---|---|---|
| `20260101000000_phase-1b-budgeting-additive.sql` | Canonical additive budgeting schema + hardened RLS | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` |
| `20260101000000_phase-1b-budgeting-additive.rollback.sql` | Local/test rollback (not for production) | see file |
| `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` | Phase 1B-R1I-c.3D: BEFORE INSERT trigger enforcing round-up instruction eligibility (disabled / archived-goal / missing / inconsistent) with FOR SHARE row locks — additive only | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` |
| `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.rollback.sql` | Local/test rollback — removes only the c.3D trigger and function | `716eb01765942fce1e24897ee5b6414b1e2f3b750c181fe8507b87a4916f89ea` |


The canonical SQL is byte-identical to
`docs/audits/phase-1/executable/01_additive_migration.sql`, which is the file
executed under the Phase 1B-R1I-c.1E local Postgres harness (21/21 assertions
PASS, two clean-reset schema hashes identical).

## Promotion procedure

Promotion into `supabase/migrations/` requires:

1. Database Owner sign-off
2. Security Officer sign-off
3. Compliance & Data Protection Officer sign-off
4. Release Manager sign-off
5. Chief Architect / Phase Guardian sign-off

On promotion:
- Preserve filename timestamp semantics as required by Supabase ordering.
- Do NOT rename or edit the SQL body; the promoted file MUST hash-match the
  checksum above. Any diff invalidates all prior test evidence.
- Re-run the parity harness against a Supabase-authenticated environment.
