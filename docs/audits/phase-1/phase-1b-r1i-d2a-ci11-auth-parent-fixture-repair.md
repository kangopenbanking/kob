# Phase 1B — R1I-d.2A-CI11 — Auth-parented representative fixture repair

## Context

- GitHub Actions run: **29841796444** (job 88672277414)
- Tested SHA: `e52e612d9cea1ddb9bbc6822c1c7c49d793f04df`
- CI10A: **PASS** (IPv6 loopback normalisation accepted)
- Passing stages before this failure:
  - isolated local Supabase startup
  - complete canonical migration chain
  - environment guard and local-Supabase attestation
  - disposable-environment bootstrap
  - canonical reset 1 and 2 (identical schema + index hashes)
  - pending Phase 1 migration chain
  - online concurrent index harness
  - canonical/concurrent index structural parity
- First failing step:
  `Representative fixture (parents-first, per-table builders, required-column preflight)`
- Exact failure:
  `insert or update on table "user_roles" violates foreign key constraint "user_roles_user_id_fkey"`

## Root cause

`public.trg_assign_merchant_role` runs `AFTER INSERT ON public.gateway_merchants`
and inserts into `public.user_roles`, whose `user_id` column carries a real
foreign key to `auth.users(id)`. The prior fixture invented deterministic
`user_id` values that had no corresponding `auth.users` row, so the trigger's
downstream insert violated the FK.

This is a fixture orchestration defect. The production trigger, the FK, the
`user_roles` table, and the `auth` schema are all correct and must remain
untouched.

## CI11 — auth-parented fixture orchestration

`scripts/phase1b-d2a/fixture.mjs`:

1. `runGuard()` still runs first, proving the attested local Supabase stack.
2. Before any DB work, the fixture creates or resolves exactly **eight**
   disposable local Auth users through the local Supabase Auth Admin API
   (`${SUPABASE_URL}/auth/v1/admin/users`), sending both `apikey` and
   `Authorization: Bearer` headers with the local `SUPABASE_SERVICE_ROLE_KEY`.
3. Deterministic emails: `d2a-fixture-merchant-0@fixture.d2a.local` …
   `d2a-fixture-merchant-7@fixture.d2a.local`.
4. Per-user metadata `{ d2a_fixture: true, merchant_index: <n> }`.
5. `email_confirm: true`. A strong per-run test-only password is minted with
   `crypto.randomBytes(24).toString("hex")`, never logged, never printed,
   never written to evidence.
6. `200`/`201` are treated as successful creation. `400`/`409`/`422` are
   narrowly interpreted as "user already exists" and the existing local user
   is located via `GET /auth/v1/admin/users?email=...`. Any other status
   fails closed and records only `{ status, merchantIndex, redactedSummary }`
   (≤200 chars).
7. `buildParentMerchant()`, `merchantIdFor()`, `userIdFor()` and
   `tenantIdFor()` retain their exact deterministic outputs (existing CI3
   tests unaffected).
8. During `loadParents()`, only the inserted row's `user_id` is overridden
   with the resolved Auth Admin user ID for that merchant index.
9. Post-insert database validation:
   - Auth-parent coverage:
     `SELECT count(*) FROM public.gateway_merchants gm JOIN auth.users au ON au.id = gm.user_id WHERE gm.id = ANY($1)` → must be `8`.
   - Merchant-role trigger coverage:
     `SELECT count(*) FROM public.gateway_merchants gm JOIN public.user_roles ur ON ur.user_id = gm.user_id AND ur.role = 'merchant' WHERE gm.id = ANY($1)` → must be `8`.
   - Duplicate merchant roles for fixture users → must be `0`.
   Any deviation aborts with a structured error.
10. `fixture-summary.json` gains non-secret fields:
    `authUsers: { requested, created, reused, resolved }`,
    `authUserParentCoverage`, `merchantRoleTriggerCoverage`,
    `duplicateMerchantRoles`. On failure, the summary also carries
    `{ error, errorCode, errorConstraint, errorTable }` (pg-driver metadata,
    no credentials).
11. No Auth user IDs, passwords, keys, tokens or Authorization headers are
    ever persisted to evidence.

## Preserved production invariants

The following are **not** modified, disabled, dropped, deferred, or bypassed:

- `public.trg_assign_merchant_role`
- `public.assign_merchant_role_on_create()`
- `public.user_roles`
- `user_roles_user_id_fkey`
- `auth.users`
- `session_replication_role`
- any RLS policy
- any migration file

No SQL insert against `auth.users` occurs. Auth identity creation happens
exclusively through the local GoTrue admin API.

## Workflow (`.github/workflows/phase1b-r1i-d2a-verification.yml`)

- Header comment appended: `# CI11 auth-parented representative fixture`.
- Static suite step renamed to
  `Static infrastructure suite (guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 + CI8 + CI9 + CI10 + CI11)`.
- Adds
  `src/test/phase1b-d2a-ci11-auth-parent-fixture-reproducibility.test.ts`
  to the explicit Vitest suite.
- No credential changes: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  continue to originate exclusively from the disposable local Supabase
  stack via `supabase status -o env`.
- Preserved verbatim: early evidence cleanup, pinned Supabase CLI
  (`2.101.0`), guard attestation, both canonical resets, pending migration
  chain, online index harness, fixture step ordering, runtime server
  ownership, OpenAPI gates, three full-suite runs, build, fail-closed
  teardown, artifact upload, restricted push trigger, and
  `workflow_dispatch`.

## Static tests

`src/test/phase1b-d2a-ci11-auth-parent-fixture-reproducibility.test.ts`
covers the 28 assertions specified in the mandate plus an additional
sanity check that CI3 exports remain intact.

## Invariants preserved

- API version: 4.53.1 (Unreleased)
- Operation count: 483
- Gate total: 176
- Rollup: 4.44.2
- Supabase CLI: 2.101.0
- Managed Lovable Supabase access: 0
- No migration file changed
- No OpenAPI, gateway runtime, pagination adapter, extension audit,
  publication audit, pending migration, or package dependency change
- Teardown remains `if: always()` and fail-closed
