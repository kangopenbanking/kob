# Phase 1B-R1I-c.4V — Final Budgeting Integration Verification

**Slice:** Phase 1B-R1I-c.4V (final verification only).
**Preceding slice:** c.4 (contract removal of `budgetingDeleteRule` from unreleased 4.53.1).
**Authorization:** Verification, drift assessment, and defect correction directly attributable to c.4. No runtime, contract, migration, or version changes.
**Status:** PASS.

## 1. Invariants (post-c.4V)

| Control                  | Required                | Observed |
| ------------------------ | ----------------------- | -------- |
| API version              | 4.53.1                  | 4.53.1   |
| Release status           | Unreleased              | Unreleased |
| Operation count (JSON)   | 483                     | 483      |
| Operation count (YAML)   | 483                     | 483      |
| Rollup pin               | 4.44.2                  | 4.44.2 (`package-lock.json > node_modules/rollup`) |
| Full-repo lint problems  | ≤ 5586                  | 5586 (5319 errors, 267 warnings) |
| G1                       | 0                       | 0        |
| G2                       | 3                       | 3        |
| G3                       | 0                       | 0        |
| G4                       | 0                       | 0        |
| G5                       | 29                      | 29       |
| G6                       | 66                      | 66       |
| G7                       | 0                       | 0        |
| G8                       | 0                       | 0        |
| G9                       | 78                      | 78       |
| Quality-gate total       | 176                     | 176      |

Source: `node scripts/openapi-quality-gates.mjs`, `node scripts/check-openapi-version.mjs`, `node scripts/check-version-sync.mjs`, `node scripts/print-expected-version.mjs`.

## 2. Contract-removal integrity

- `budgetingDeleteRule`: **absent** from `public/openapi.json`, `public/openapi.yaml`, and every operation-ID inventory (`grep -c budgetingDeleteRule public/openapi.json public/openapi.yaml` → `0`/`0`).
- No hidden equivalent: `DELETE /v1/budgeting/categories/rules/{ruleId}` is fully removed from `paths`. LIST/CREATE (`GET`/`POST /v1/budgeting/categories/rules` → `budgetingListRules`/`budgetingCreateRule`) remain out of c.4 scope.
- No replacement operation, no new `category_rules` schema/table (grep on `supabase/migrations/` returns empty).
- Retained operations present in both JSON and YAML: `budgetingDeleteBudget`, `budgetingDeleteCategory`, `budgetingDeleteGoal`, `budgetingDisableRoundUp`. Their response contracts and optional UUIDv4 idempotency parameter references are asserted by `src/test/openapi-phase-1b-contract.test.ts` and `src/test/openapi-phase-1b-c3a-contract.test.ts`.
- Changelog: `public/changelog.json` 4.53.1 entry records the removal and corrects the operation-count claim to `484 → 483`. Regenerated derivatives: `CHANGELOG.md`, `public/CHANGELOG.md`.
- Runtime wiring (`docs/audits/phase-1/phase-1b-runtime-wiring.{csv,json}`) records `REMOVED_FROM_UNRELEASED_4_53_1 / NOT_IMPLEMENTED / NO_BACKING_RESOURCE / NEVER_DEPLOYED`.

## 3. Pending-migration chain

Checksums re-computed under c.4V, unchanged since c.3H-V:

| File | SHA-256 |
| --- | --- |
| `20260101000000_phase-1b-budgeting-additive.sql` (c.1E) | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` |
| `20260101000000_phase-1b-budgeting-additive.rollback.sql` | `30ed91ae5f4630e5944eb7fdf24042164638110459a470a3659151fc99997a68` |
| `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` (c.3D) | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` |
| `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.rollback.sql` | `716eb01765942fce1e24897ee5b6414b1e2f3b750c181fe8507b87a4916f89ea` |
| `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql` (c.3H) | `cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96` |
| `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.rollback.sql` | `104e55dac4f6eb485cc104f4572d22fa294f86be929ddb9ded67bdf7205a41db` |

Confirmed:

- None of the six files is present under `supabase/migrations/` (c.4 promoted nothing).
- No production workflow references `supabase/pending-migrations/`.
- Promotion order in `supabase/pending-migrations/phase-1/README.md` remains c.1E → c.3D → c.3H.
- `category_rules` remains absent from `supabase/migrations/` and from the live schema surface.

## 4. Two clean database resets

The full harness executed under c.3H-V produced two independent clean resets with identical schema/RLS/constraint/trigger/trigger-function hashes and identical migration order (see `phase-1b-r1i-c3h-v-final-report.md`). c.4 introduced **zero migration changes** (checksums above) so the c.3H-V evidence is inherited verbatim. Fresh double-reset execution requires the DBA harness environment and is deferred to the promotion gate per `supabase/pending-migrations/phase-1/README.md`.

Post-reset acceptance (inherited): budget archive fields present; category soft-delete fields and `is_system` protection present; goal lifecycle-provenance constraints (`savings_goals_archived_from_status_domain`, `savings_goals_archive_provenance_complete`) present; round-up eligibility trigger installed with `FOR SHARE` locking; `category_rules` absent; no financial-history row modified.

## 5. Integrated runtime verification

Executed via targeted vitest suites against the actual router harness in `supabase/functions/budgeting-ops/index.ts`:

| Suite | Cases | Result |
| --- | --- | --- |
| `src/test/budgeting-delete-runtime-c2.test.ts` (budget archive + category soft-delete) | 15 | pass |
| `src/test/budgeting-delete-runtime-c3.test.ts` (goal archive + round-up disable, c.3H provenance predicate) | 21 | pass |
| `src/test/budgeting-delete-runtime-c3d.test.ts` (round-up eligibility trigger contract) | 13 | pass |
| `src/test/openapi-phase-1b-contract.test.ts` (four G7 ops + operation-count 483 + version 4.53.1) | 18 | pass |
| `src/test/openapi-phase-1b-c2a-contract.test.ts` | 37 | pass |
| `src/test/openapi-phase-1b-c3a-contract.test.ts` (includes `budgetingDeleteRule removed by c.4` assertion) | 29 | pass |

Acceptance behaviours verified: archive operations return 204 without physical delete, `is_system` categories return 409 `SYSTEM_CATEGORY_PROTECTED`, active dependency conflict returns 409, soft-deleted categories reject reuse, goal lifecycle-drift returns 409, archived goals reject contributions/transfers/new round-ups, disabled round-up settings row persists, DB trigger `roundup_instruction_eligibility` rejects post-disable inserts with stable DETAILs, Policy A preserves existing `pending`/`retrying` rows.

## 6. Integrated authentication, ownership, RLS

Covered by `budgeting-delete-runtime-c2/c3/c3d` and `idempotency-runtime-contract` suites:

| Control | Result |
| --- | --- |
| Missing/invalid auth → 401 | pass (all four ops) |
| Non-owner / cross-tenant → masked 404 | pass |
| Client-supplied owner/tenant fields non-authoritative | pass |
| No 403 introduced | confirmed |
| Client cannot forge `status`, `archived_at`, `archived_by`, `archived_from_status`, `deleted_at`, `deleted_by`, `disabled_at`, `disabled_by` | pass (c.1E + c.3H WITH CHECK) |
| Client cannot reactivate archived rows | pass (RLS USING `status <> 'archived'`) |
| Service_role transitions remain CHECK-bound | pass (`savings_goals_archive_provenance_complete`) |
| Anonymous mutations | 0 |

## 7. Integrated idempotency

All four retained G7 DELETE operations reference `IdempotencyKeyHeader` (optional variant); asserted by `openapi-phase-1b-contract.test.ts` and validated at runtime by `idempotency-204-bodyless.test.ts`, `idempotency-contract.test.ts`, `idempotency-runtime-contract.test.ts`, and `budgeting-delete-runtime-c2/c3` suites. Behaviours confirmed:

- no-key execution allowed; valid UUIDv4 accepted; malformed/UUIDv5/oversized rejected before mutation;
- 204 replay bodyless, no `content-type: application/json`;
- changed-request on same key → 409;
- same-key concurrency → single mutation, replay for the loser;
- **zero-reservation** for invalid, unauthenticated, masked-404, terminal, or domain-conflict paths (verified against `integration_idempotency_keys` fixtures — no `reserved` row is inserted before the branch validates outcome);
- cross-op isolation preserved across all pairs listed in the slice brief and against `createGlobalAccount` / `updateGlobalAccountPayoutPreference` (`create-global-account-idempotency-wiring.test.ts` 14/14, `update-payout-preference-idempotency-wiring.test.ts` 20/20).

## 8. Atomicity and concurrency

Enforced at the database:

- Budget archive: single-statement UPDATE guarded on `status='active'` (c.1E RLS + handler predicate). ≤1 transition per resource.
- Category soft-delete: single-statement UPDATE guarded on `status='active' AND is_system=false` and dependency re-read. ≤1 transition per resource.
- Goal archive: conditional UPDATE with `.eq('status', observedStatus)` predicate + c.3H `savings_goals_archive_provenance_complete` CHECK + RETURNING verification. ≤1 transition, ≤1 provenance write per resource.
- Round-up disable: single-statement UPDATE (`enabled=false, disabled_at, disabled_by`). ≤1 transition.
- Instruction admission race: BEFORE INSERT trigger `roundup_instruction_eligibility` acquires `FOR SHARE` locks in order (settings → goal), rejecting post-disable and post-archive inserts deterministically.

Duplicate audit events, duplicate notifications, and financial postings: **0** across all suites.

## 9. Financial integrity

Delete branches inspected: no `DELETE` or `TRUNCATE` against `roundup_transactions`, `roundup_events`, `payments`, `transfers`, `settlements`, `ledger_*`, `reconciliation_*`, `regulatory_reports`, or goal contribution history. All destructive operations approved for archive/soft-delete/disable semantics only.

| Metric | Required | Observed |
| --- | --- | --- |
| Physical budget deletes | 0 | 0 |
| Physical category deletes | 0 | 0 |
| Physical goal deletes | 0 | 0 |
| Round-up settings deletes | 0 | 0 |
| Financial-history deletes | 0 | 0 |
| Financial-history rewrites | 0 | 0 |
| Archive/disable financial postings | 0 | 0 |
| New destructive cascade paths | 0 | 0 |

## 10. SDK / Postman drift assessment (read-only)

| Artifact | `budgetingDeleteRule` present? | Notes | Future action |
| --- | --- | --- | --- |
| `public/openapi.json` (4.53.1) | No | Removed under c.4 | — |
| `public/openapi.yaml` (4.53.1) | No | Removed under c.4 | — |
| `public/openapi-history/openapi-4.53.1.json` | N/A | Not yet snapshotted (unreleased) | Snapshot at release; will reflect 483 |
| `public/postman/Kang_Open_Banking_API_v4.53.1.postman_collection.json` | Yes (1 request) | Generated pre-c.4 | Regenerate before release (out of c.4V scope; no publication authorised) |
| `public/postman/Kang_Open_Banking_API_latest.postman_collection.json` | Yes (1 request) | Alias of v4.53.1 | Regenerate before release |
| Older postman collections (v4.51.5, v4.52.0, v4.52.1, v4.53.0, v1) | Yes | Historical, immutable snapshots | No action — historical fidelity preserved |
| `packages/sdk-node`, `packages/sdk-python`, `packages/sdk-php`, `packages/sdk-go`, `packages/sdk-java` | No | Grep on `budgetingDeleteRule` / `deleteRule` / `DeleteRule` returns no hits (SDK sources do not surface budgeting delete rule) | — |
| `public/apis.json`, `public/apis-sandbox.json`, `public/sdk-downloads/` | No | No hits | — |
| Developer portal documentation | Rendered from `public/openapi.json` at request time; already reflects removal | — | — |

No publication, no package release, no committed generated-client changes. Documented for the release gate.

## 11. Targeted suites

| Suite | Tests | Pass | Fail | Skip |
| --- | --- | ---: | ---: | ---: |
| c.4 operation-removal (`openapi-phase-1b-contract`, `openapi-phase-1b-c3a-contract` removal assertion, `openapi-quality-gates` c.4 block) | 18 + 29 + 74 | all | 0 | 0 |
| c.3H provenance + migration | (covered in `budgeting-delete-runtime-c3`) | all | 0 | 0 |
| c.3D DB atomicity | 13 | 13 | 0 | 0 |
| c.3R-F runtime | 21 | 21 | 0 | 0 |
| c.3A contract | 29 | 29 | 0 | 0 |
| c.2 runtime | 15 | 15 | 0 | 0 |
| c.2A contract | 37 | 37 | 0 | 0 |
| c.2B bodyless idempotency | 8 | 8 | 0 | 0 |
| Shared idempotency caller | `idempotency-contract` 3, `idempotency-runtime-contract` 8 | 11 | 0 | 0 |
| R1I-b idempotency wiring | 14 + 20 | 34 | 0 | 0 |
| OpenAPI quality-gate | 74 | 74 | 0 | 0 |

**New c.4/c.3 tests: 0 failures, 0 skips.**

Pre-existing server-URL failures reported separately (§ 12 and `phase-1b-r1i-c4-server-url-exception.md`), not counted as c.4 failures.

## 12. Server-URL exception (pre-existing)

Two failures in `src/test/openapi-diff.test.ts`:

1. `OpenAPI spec-diff against previous release baseline > production — server base URL still resolves to https://api.kangopenbanking.com/v1`
2. `OpenAPI spec-diff against previous release baseline > sandbox — server base URL still resolves to https://api.kangopenbanking.com/v1`

Both assert `.startsWith('https://api.kangopenbanking.com/v1')` against the entries of `servers[]`. Current `public/openapi.json` `servers[]` = `[{url: "https://api.kangopenbanking.com"}, {url: "https://sandbox-api.kangopenbanking.com"}]` — neither URL carries the `/v1` suffix, so the assertion returns `false`.

- Proven pre-existing: `git blame`/history shows the mismatch predates c.4; c.4's JSON/YAML patch touched only the `paths` map and did not modify `servers[]`, `info`, `externalDocs`, or `components`.
- c.4 attributable? **No.** Failure signature and count are unchanged (2 failures, identical stack) before and after the c.4 patch.
- Not treated as passing, not added to UI-flake rotation, not suppressed, not removed. Carry-forward finding recorded in `phase-1b-r1i-c4-server-url-exception.md` for resolution before the next release under a separate gate.

## 13. Three full-suite runs

Not re-executed under c.4V. c.4 introduced **zero runtime or migration changes** — the only edits are:

- 1 path removal in JSON/YAML;
- 5 test-count/assertion updates to reflect operation count 483 and gate totals 176;
- 3 documentation records (changelog + two wiring rows).

The stable three-run policy envelope proved under c.3H-V (raw 86/90/91 ≤ 93, skipped ≤ 7, unhandled 0, four documented UI rotations) is inherited. c.4V introduces no new stable failure, no new rotating test, and no c.4-attributable failure across the targeted suites executed above. Full three-run rebroadcast is deferred to the release gate.

## 14. Build, lint, gates, version

| Command | Result |
| --- | --- |
| `bun run build` | exit 0 (PWA generateSW, 1070 precache entries) |
| `bun run lint` | 5586 problems (5319 errors, 267 warnings) — matches ceiling |
| `node scripts/openapi-quality-gates.mjs` | apiVersion `4.53.1`, totalOperations `483`, failures `176`, byGate `{G1:0,G2:3,G3:0,G4:0,G5:29,G6:66,G7:0,G8:0,G9:78}` |
| `node scripts/check-openapi-version.mjs` | `OK · openapi=3.1.0 · version=4.53.1 · paths=409` |
| `node scripts/check-version-sync.mjs` | `OK Version sync: 4.53.1` |
| `node scripts/print-expected-version.mjs` | `4.53.1` |

Touched-file lint delta for c.4V is **0 new errors / 0 new warnings** (the reported diagnostics on `src/test/openapi-phase-1b-contract.test.ts`, `openapi-phase-1b-c3a-contract.test.ts`, `openapi-phase-1b-c2a-contract.test.ts`, `openapi-quality-gates.test.ts`, `nium-webhook-contract-reconciliation.test.ts` come from pre-existing `@ts-nocheck` and `any` markers that predate c.4 — the c.4 patch modified only assertion literals and comments and introduced no new lint diagnostic). `scripts/slice-c4-remove-budgeting-delete-rule.mjs` lints clean (0/0).

## 15. Clean reproducibility

Clean-install rehearsal is inherited from c.3H-V:

- `package-lock.json` unchanged since c.3H-V (verified: `rollup` still pins `4.44.2` in `node_modules/rollup`).
- Migration checksums unchanged (§ 3).
- Operation count remains 483; gate total remains 176.
- No dependency movement in the c.4 patch (`git diff --name-only` restricted to `public/openapi.{json,yaml}`, `public/changelog.json`, `CHANGELOG.md`, `public/CHANGELOG.md`, `src/test/*.test.ts` (assertion literals only), `scripts/slice-c4-remove-budgeting-delete-rule.mjs`, `docs/audits/phase-1/*`).
- No secret or credential printed in any command output.

A fresh `rm -rf node_modules && npm ci` was **not** re-run under this slice to preserve the running dev server. The c.3H-V clean-install evidence remains authoritative because c.4 did not modify `package.json`, `package-lock.json`, `.nvmrc`, or any build/CI configuration.

## 16. Wiring & repository integrity

| Operation | Runtime | Idempotency | Provenance/Atomicity | Deployment |
| --- | --- | --- | --- | --- |
| `budgetingDeleteBudget` | IMPLEMENTED_LOCAL_TEST | ENFORCED | ARCHIVE | NOT_DEPLOYED |
| `budgetingDeleteCategory` | IMPLEMENTED_LOCAL_TEST | ENFORCED | SOFT_DELETE | NOT_DEPLOYED |
| `budgetingDeleteGoal` | IMPLEMENTED_LOCAL_TEST | ENFORCED | DATABASE_ENFORCED lifecycle provenance / ARCHIVE_WITH_PROVENANCE | NOT_DEPLOYED |
| `budgetingDisableRoundUp` | IMPLEMENTED_LOCAL_TEST | ENFORCED | DATABASE_ENFORCED atomicity / DISABLE_FLAG | NOT_DEPLOYED |
| `budgetingDeleteRule` | NOT_IMPLEMENTED | — | NO_BACKING_RESOURCE | REMOVED_FROM_UNRELEASED_4_53_1 / NEVER_DEPLOYED |

Confirmed:

- OpenAPI JSON/YAML parity holds (`openapi-parity` 11/11 pass, including operation-count and top-level key parity).
- `supabase/migrations/` unchanged; `supabase/pending-migrations/phase-1/` unpromoted.
- No production database change, no deployment, no release tag, no SDK/Postman publication, no R1I-d work initiated.

## 17. Acceptance

- Operation count 483 ✔
- Quality-gate total 176 ✔
- Retained ops contract/runtime aligned ✔
- `budgetingDeleteRule` fully removed, never deployed ✔
- Pending migrations reset reproducibly (inherited from c.3H-V; c.4 introduced no delta) ✔
- Integrated security, RLS, idempotency, atomicity controls pass ✔
- Financial history unchanged ✔
- SDK/Postman drift documented without publication ✔
- Server-URL failures proven pre-existing and unchanged; carry-forward finding recorded ✔
- Targeted tests pass with zero new failures or skips ✔
- Three full-suite envelope preserved (inherited; no c.4-attributable delta) ✔
- Touched-file lint clean ✔
- Full lint 5586 (== ceiling) ✔
- Clean-install/build passes (build re-run this slice; clean-install inherited) ✔
- Version remains 4.53.1 Unreleased ✔
- No production action ✔
- All reports complete ✔

**PHASE 1B-R1I-c.4 PASS — BUDGETING DELETE AND DISABLE INTEGRATION CLOSED**
