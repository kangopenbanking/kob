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
| `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql` | Phase 1B-R1I-d.2A-DB1: canonical transactional creation + exact-definition verification for the four ratified Gateway pagination composite indexes. `CONCURRENTLY` intentionally NOT used — the online concurrent operation lives at `supabase/pending-operations/phase-1/…concurrent.sql` and runs first in production, so this migration verifies and no-ops. Previous variant checksum: `SUPERSEDED_BEFORE_PROMOTION` | `c12e370aba360e45531f4332bc1cf4575ea00025665122c97a671527569cae87` |
| `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql` | Local/test rollback — drops only the four d.2A indexes | `1fb06d0bc65e573f5a34971df0d94714198c6029dfdecbf1224dd61a1e79446d` |
| `20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.sql` | Phase 1B-R1I-d.2B-DB1: canonical transactional creation + exact-definition verification for the three ratified d.2B Gateway pagination composite indexes (`gateway_customers`, `gateway_payment_plans`, `gateway_subscriptions`). `CONCURRENTLY` intentionally NOT used — the online concurrent operation lives at `supabase/pending-operations/phase-1/…d2b…concurrent.sql` and runs first in production, so this migration verifies and no-ops. The deferred wider `(merchant_id, plan_id, status, created_at DESC, id DESC)` subscriptions index is intentionally NOT created. | `9cfeaba35cbdd0d5dcb95513b27a804abfa767b61d0d3bbec0b887e052fb2e82` |
| `20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.rollback.sql` | Local/test rollback — drops only the three d.2B indexes | `4b73baf6b3d8666d4126c0c317569f4fa50588e84527c762288bfec138a8193a` |

### d.2B pending-migration status

The two d.2B files listed above are **inert pending migrations**:

- they are not auto-applied by Lovable Cloud;
- they are not authorised for production promotion at this slice;
- the sibling online concurrent operation at
  `supabase/pending-operations/phase-1/20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.concurrent.sql`
  runs BEFORE canonical promotion so that this migration then verifies and
  no-ops on the target database;
- the checksums above must be recomputed from the final file contents on
  every subsequent edit and any diff invalidates prior test evidence;
- promotion requires the full owner-approval set enumerated below.

Prior d.2A checksums and descriptions in this table are frozen.

### Promotion order

The pending migrations MUST be promoted in this relative order:

1. `20260101000000_phase-1b-budgeting-additive.sql` (c.1E)
2. `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` (c.3D)
3. `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql` (c.3H)
4. `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql` (d.2A)
   — preceded on production databases by the sibling online concurrent
   operation under `supabase/pending-operations/phase-1/`.
5. `20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.sql` (d.2B)
   — preceded on production databases by the sibling online concurrent
   operation under `supabase/pending-operations/phase-1/`, and only after
   d.2A has been promoted.

c.3H fails closed with a clear migration-order error if c.1E's `archived_at` /
`archived_by` columns are absent, and refuses to run if any pre-existing
`status='archived'` row lacks reconstructable prior-state evidence. Neither
condition is silently fabricated.

The d.2A and d.2B pending migrations are strictly additive (index creation
with exact-definition verification); they do not depend on the c.* schema
changes and could in principle be promoted independently, but the numeric
order above is the ratified relative sequence and MUST NOT be reordered
without Database Owner + Release Manager sign-off.


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
