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
| `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql` | Phase 1B-R1I-c.3H: adds `savings_goals.archived_from_status`, lifecycle-integrity CHECK constraints, and hardened INSERT/UPDATE RLS forbidding client-side provenance forgery. Fail-closed migration-order guard + backfill safety guard | `cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96` |
| `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.rollback.sql` | Local/test rollback — drops `archived_from_status` and c.3H constraints; warns on populated provenance; c.1E and c.3D objects untouched | `104e55dac4f6eb485cc104f4572d22fa294f86be929ddb9ded67bdf7205a41db` |

### Promotion order

The three pending migrations MUST be promoted in this order:

1. `20260101000000_phase-1b-budgeting-additive.sql` (c.1E)
2. `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` (c.3D)
3. `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql` (c.3H)

c.3H fails closed with a clear migration-order error if c.1E's `archived_at` /
`archived_by` columns are absent, and refuses to run if any pre-existing
`status='archived'` row lacks reconstructable prior-state evidence. Neither
condition is silently fabricated.


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
