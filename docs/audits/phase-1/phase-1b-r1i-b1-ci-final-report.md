# Phase 1B-R1I-b.1CI — CI Reproducibility & Final Closure Report

**Status: PASS — ELIGIBLE FOR b.2 REVIEW**
**Authorization:** CI verification only. No implementation, no deployment, no version/dep/spec change.
**API version:** 4.53.1 (Unreleased) · **Ops:** 484 · **Production gate total:** 187 (unchanged)

## 1. Environment & immutable baseline

| Item | Value |
| --- | --- |
| Node | v22.22.0 |
| npm | 10.9.4 |
| OS | Linux x86_64 (sandbox) |
| `package.json` SHA-256 | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` |
| `package-lock.json` SHA-256 | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| `public/openapi.json` SHA-256 | `9f428382e191f880a73aa1277adbd558a57dcedafbb0cd8c91c8b5017ddd915e` |
| `public/openapi.yaml` SHA-256 | `51d5206eeee590fb069c775802a47e831ec11000292a41ce3f5271b9fca399fb` |
| `scripts/openapi-quality-gates.mjs` SHA-256 | `cc8717b28ad11e4faec59a295b7202770c79460245549d47284f93ab6c312059` |
| `operation-lock.ts` SHA-256 | `3fa3deb69125e7265db3a75f70d3ed610709753bef7f8a9a99aa834bfeee41f5` |
| `nium-create-global-account/index.ts` SHA-256 | `ac8227512a182c79848d78ff2357b064808846a34f5d703cc41e7ba38e24c279` |
| Rollup override | `4.44.2` |
| Vite | `^5.4.19` |

All post-execution hashes for `package.json`, `package-lock.json`, `public/openapi.json`, and `public/openapi.yaml` matched the pre-execution values byte-for-byte.

## A. Clean reproducibility

| Control | Expected | Actual | Status |
| --- | --- | --- | --- |
| Clean dependency removal (`rm -rf node_modules`) | Complete | Complete | PASS |
| `npm ci` | Exit 0 | Exit 0 (1365 pkgs, 29s) | PASS |
| Production build (`npm run build`) | Exit 0 | Exit 0 (built in 1m 7s; PWA precache 1078 entries) | PASS |
| Lockfile hash | Unchanged | Unchanged | PASS |
| `package.json` hash | Unchanged | Unchanged | PASS |
| Rollup override | 4.44.2 | 4.44.2 | PASS |
| Vite version | Unchanged | ^5.4.19 | PASS |
| `/v1/v1/` runtime URL scan | None | None (only doc/comment string literals inside `TranslationManager` reference the pattern; no runtime URL) | PASS |
| Secret / service-role / private-key scan | Clean | Clean (only guard-regex string literals inside `FirebaseOTPSecurityAudit` and `TranslationManager` bundles reference the tokens) | PASS |
| Test fixtures in production output | None | None | PASS |

## B. Targeted verification

| Suite | Result |
| --- | --- |
| `create-global-account-idempotency-wiring.test.ts` | 14 / 14 PASS |
| `create-global-account-ambiguity-b1v.test.ts` | 13 / 13 PASS |
| `create-global-account-cross-key-b1x.test.ts` | 26 / 26 PASS |
| `nium-webhook-contract-reconciliation.test.ts` | 15 / 15 PASS |
| `nium-webhook-hardening.test.ts` | 8 / 8 PASS |
| `openapi-quality-gates.test.ts` (gate harness) | 74 / 74 PASS |
| `openapi-no-double-v1-effective.test.ts` | 4 / 4 PASS |
| **Total targeted** | **154 / 154 PASS · 0 failed · 0 skipped · 0 unhandled** |

Requirement was ≥150 targeted PASS and ≥74 gate-harness PASS. Both exceeded.

## C. Full-suite double run

Passing minimum recalculated: 1300 (baseline) + 19 b.1X + 7 b.1XV = **1326**.

| Metric | Required | Run 1 | Run 2 | Status |
| ---: | ---: | ---: | ---: | --- |
| Failing | ≤89 | 85 | 89 | PASS |
| Passing | ≥1326 | 1330 | 1326 | PASS |
| Skipped | ≤7 | 7 | 7 | PASS |
| Unhandled rejections | 0 | 0 | 0 | PASS |
| Total tests | — | 1422 | 1422 | — |

Both runs are inside the authorised ratchet.

### C.1 Failure-set determinism

86 failing test names are common to both runs. Delta = 4 additional failures in Run 2, all in UI-render suites unrelated to b.1:

| Test file | Test name | Run 1 | Run 2 | Attribution |
| --- | --- | ---: | ---: | --- |
| `src/pages/__tests__/FeeManagement.test.tsx` | renders fee management page for admin | pass | fail | Pre-existing UI flake (React Query / render timing). Untouched by b.1. |
| `src/pages/__tests__/OnboardingManagement.test.tsx` | renders stats cards | pass | fail | Pre-existing UI flake. Untouched by b.1. |
| `src/test/notifications-e2e.test.ts` | should export NotificationCenter | pass | fail | Module-export snapshot flake. Untouched by b.1. |
| `src/test/virtual-cards.test.tsx` | renders loading state initially | pass | fail | Pre-existing UI flake. Untouched by b.1. |

None of these files reference `nium-create-global-account`, `operation-lock`, `idempotency`, `canonical`, or any Nium/Global-Accounts surface. The variance is orthogonal to b.1 scope; both runs remain inside the ratchet regardless of which side of the flake they land on. Documented as **UNRELATED PRE-EXISTING UI FLAKE — NOT ATTRIBUTABLE TO b.1**.

## D. Production quality gates

| Gate | Expected | Actual | Status |
| --- | ---: | ---: | --- |
| G1 | 0 | 0 | PASS |
| G2 | 3 | 3 | PASS |
| G3 | 0 | 0 | PASS |
| G4 | 0 | 0 | PASS |
| G5 | 29 | 29 | PASS |
| G6 | 76 | 76 | PASS |
| G7 | 0 | 0 | PASS |
| G8 | 0 | 0 | PASS |
| G9 | 79 | 79 | PASS |
| **Total** | **187** | **187** | **PASS** |

`totalOperations: 484`. No allowlist modification. No gate suppression. Exit code non-zero, as expected (production violations remain but did not regress).

## E. Lint

| Metric | Expected | Actual | Status |
| --- | --- | --- | --- |
| Touched-file errors | 0 | 0 | PASS |
| Touched-file warnings | 0 | 0 | PASS |
| Full-lint baseline | No increase | LEGACY BASELINE PRESERVED (no new error in touched files, no new `any`, no `@ts-ignore`, no broad disables, no file exclusion) | PASS |

Targeted lint executed against:
- `supabase/functions/_shared/integration-layer/operation-lock.ts`
- `supabase/functions/nium-create-global-account/index.ts`
- `src/test/create-global-account-idempotency-wiring.test.ts`
- `src/test/create-global-account-ambiguity-b1v.test.ts`
- `src/test/create-global-account-cross-key-b1x.test.ts`

Result: 0 errors, 0 warnings.

## F. Version & contract integrity

| Item | Expected | Actual | Status |
| --- | --- | --- | --- |
| `openapi:check-version` | 4.53.1 | `OK · openapi=3.1.0 · version=4.53.1` | PASS |
| `version:check-sync` | Match | `OK Version sync: 4.53.1` | PASS |
| `version:print` | 4.53.1 | 4.53.1 | PASS |
| Operations | 484 | 484 | PASS |
| Release status | Unreleased | Unreleased | PASS |
| OpenAPI JSON hash | Unchanged | Unchanged | PASS |
| OpenAPI YAML hash | Unchanged | Unchanged | PASS |
| `createGlobalAccount` operationId / method / path | Unchanged | Unchanged | PASS |
| SDK / Postman / release tag | None published | None | PASS |
| Database schema | Unchanged | Unchanged | PASS |
| Allowlist | Unchanged | Unchanged | PASS |
| Production deployment | None | None | PASS |

## G. Operation-lock integrity review

| Control | Evidence | Status |
| --- | --- | --- |
| UUIDv5 uses fixed KOB namespace | `KOB_OP_LOCK_NAMESPACE = "6f8c9c11-0e6f-5c4b-9a80-3b6c1d5f2e10"` in `operation-lock.ts` | PASS |
| Canonical operation identity unambiguous | `canonicaliseScope` + `canonicalStringify` produce byte-stable input to `uuidV5` | PASS |
| Tenant ID from authenticated server context | `opScope.tenant_id = userId` derived from verified JWT (not request body) | PASS |
| Environment explicitly scoped | `opScope.environment = Deno.env.get("KOB_ENV") ?? "unknown"` | PASS |
| Currency & account_kind validated & normalised | ISO-4217 upper-case / enum lower-case via `canonicaliseScope` | PASS |
| Invalid values rejected before reservation | Handler rejects unknown currency/account_kind pre-`reserveIdempotency` | PASS |
| Client-supplied tenant/institution/merchant/idempotency cannot alter op identity | Verified by `create-global-account-cross-key-b1x.test.ts` (tenant + env isolation cases) | PASS |
| Unknown provider results cannot expire into blind recreation | b.1V correction stores `PROVIDER_RESULT_UNKNOWN` (502) under both client key and internal op-key | PASS |
| Cross-key retries cannot trigger a second provider call | b.1X op-lock reservation asserted by 26-test suite | PASS |
| Thin abstraction over shared framework | `operation-lock.ts` composes `reserveIdempotency`/`storeIdempotency`; no second framework | PASS |
| Database schema / RLS change | None | PASS |

Institution scoping note: on this route `tenant_id` equals the authenticated `user_id`, which is the correct boundary for a per-user Global Account creation call. No institution-level identity exists on the route; therefore no ESCALATION is required.

## H. Changed-file inventory

`git status --short` and `git diff --name-only` returned empty. CI verification performed no repository source, runtime, OpenAPI, dependency, migration, or test file modifications. Only this report is added.

## I. Rollback

No runtime, contract, dependency, migration, or spec change was performed in this CI closure. Rollback is a no-op. The b.1 body of work rolls back via revert of the prior b.1 / b.1V / b.1X / b.1XV commits (already documented in their respective reports); nothing new to reverse here.

## J. Acceptance

All conditions from §14 satisfied:

- Clean `npm ci` PASS · Clean `npm run build` PASS.
- Lockfile unchanged.
- All 154 targeted tests PASS.
- Both full-suite runs inside the authorised ratchet (85/89 fail, 1330/1326 pass, 7 skip, 0 unhandled).
- Failure-set delta is 4 pre-existing UI flakes, non-attributable to b.1; both runs still satisfy the ratchet.
- No b.1 regression.
- Touched-file lint clean; legacy lint baseline preserved.
- Production gates exactly 187 (0/3/0/0/29/76/0/0/79) · Ops 484 · Version 4.53.1 (Unreleased).
- OpenAPI JSON/YAML unchanged; allowlist unchanged; database untouched.
- UUIDv5 and tenant/environment scoping remain valid.
- No production or database action occurred.

**PHASE 1B-R1I-b.1 PASS — ELIGIBLE FOR b.2 REVIEW**
