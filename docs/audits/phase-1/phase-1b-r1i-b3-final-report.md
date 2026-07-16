# Phase 1B-R1I-b.3 — Combined G3 Runtime Idempotency Closure

**Authorization**: AUTHORIZED FOR LOCAL/TEST VERIFICATION — PRODUCTION PROHIBITED.
**Scope**: Verify `createGlobalAccount` and `updateGlobalAccountPayoutPreference`
together — cross-operation key isolation, shared-storage integrity, regression
stability, and closeout of the combined G3 runtime idempotency work.
**Not in scope**: R1I-c, Phase 1C, Phase 2, production deployment, production
migration, OpenAPI change, version increment, SDK / Postman publication,
allowlist change, unrelated handler modification.

## 1. Invariants preserved

| Item | Expected | Actual | Status |
|---|---|---|---|
| API version | 4.53.1 | 4.53.1 | PASS |
| Release status | Unreleased | Unreleased | PASS |
| Operation count | 484 | 484 | PASS |
| Production gate total | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) | 187 (identical distribution) | PASS |
| OpenAPI JSON SHA-256 | `9f428382…d915e` | `9f428382…d915e` | PASS |
| OpenAPI YAML SHA-256 | `51d5206e…399fb` | `51d5206e…399fb` | PASS |
| package-lock.json SHA-256 | `137def28…c7a5` | `137def28…c7a5` | PASS |
| package.json SHA-256 | `490aa197…acd3` | `490aa197…acd3` | PASS |
| Gate script SHA-256 | `cc8717b2…2059` | `cc8717b2…2059` | PASS |
| createGlobalAccount handler SHA-256 | `ac822751…c279` | `ac822751…c279` (unchanged this slice) | PASS |
| updateGlobalAccountPayoutPreference handler SHA-256 | `14c65377…2ee6` | `14c65377…2ee6` (unchanged this slice) | PASS |
| Rollup pin | 4.44.2 | 4.44.2 | PASS |
| Vite | ^5.4.19 | ^5.4.19 | PASS |

No handler, contract, migration, allowlist, gate script, dependency, or lockfile
was modified in this slice. Only a new source-level verification test file was
added: `src/test/global-accounts-cross-op-isolation-b3.test.ts`.

## 2. Operations in scope

### createGlobalAccount

| Field | Value |
|---|---|
| Method / Path | `POST /v1/gateway/global-accounts` |
| Handler | `supabase/functions/nium-create-global-account/index.ts` |
| Authentication | Bearer JWT (`sb.auth.getClaims`) |
| Ownership | Per-user (`user_id = claims.sub`) |
| Optional `Idempotency-Key` | UUIDv4, ≤ 255 chars |
| Request fingerprint | `sha256(canonicalStringify({scope:{user_id,method:"POST",route:RESOURCE},body:{currency,pop_code,account_kind}}))` |
| Idempotency scope | `merchant_id=user_id` + `resource="POST /v1/gateway/global-accounts"` + `key` |
| Persistence | `public.integration_idempotency_keys` via shared `reserveIdempotency` |
| Cross-key duplicate protection | UUIDv5 business-operation lock (`operation-lock.ts`) |
| Provider ambiguity | `unknown_provider_result` + reconciliation-on-replay (b.1V) |
| Replay | Cached response returned; no second provider call |
| Conflict | Same key + different fingerprint → 409 |
| In-flight | Concurrent duplicate returns 429 `Retry-After: 1` |
| Rollback | Remove `Idempotency-Key` read branch and revert to b.1 baseline (see §12) |

### updateGlobalAccountPayoutPreference

| Field | Value |
|---|---|
| Method / Path | `PATCH /v1/gateway/global-accounts/payout-preference` |
| Handler | `supabase/functions/nium-update-payout-preference/index.ts` |
| Classification | `SET_STATE` / `LOCAL_ONLY` |
| Authentication | Bearer JWT (`sb.auth.getClaims`) |
| Ownership | Per-user (`user_id`); for `scope=account` also verifies row ownership BEFORE reservation |
| Optional `Idempotency-Key` | UUIDv4, ≤ 255 chars |
| Request fingerprint | `sha256(canonicalStringify({scope:{environment,user_id,method:"PATCH",route:RESOURCE,account_id?},body:normalised}))` |
| Idempotency scope | `merchant_id=user_id` + `resource="PATCH /v1/gateway/global-accounts/payout-preference"` + `key` |
| Persistence | `public.integration_idempotency_keys` (shared) |
| Cross-key protection | Not applicable — sequential state changes may legitimately use different keys |
| Provider ambiguity | Not applicable — no external call |
| Failure precedence | 401 auth → 404 missing/unauthorised account → 400 validation → reservation. Zero reservations on any pre-reservation failure. No cached 404. |
| Stale replay rollback | Prevented — SET_STATE stores the applied body verbatim; a replay of a key whose fingerprint matches a newer post-update state is impossible because a newer client-issued call carries a different key or a different fingerprint. |

## 3. Runtime-route verification

Traced end-to-end from source:

### createGlobalAccount

| Layer | Evidence | Status |
|---|---|---|
| Public route registered | `POST /v1/gateway/global-accounts` (openapi paths) | PASS |
| Authentication | `sb.auth.getClaims(...)` before body-work | PASS |
| Tenant/user resolution | `userId = claims.sub` | PASS |
| Validation | currency + POP + account-kind normalisation | PASS |
| Optional client-key reservation | `reserveIdempotency({key,merchantId:userId,resource:RESOURCE,requestHash})` | PASS |
| UUIDv5 business-operation reservation | `operation-lock.ts` `reserveOperation(...)` | PASS |
| Provider create/reconciliation | ambiguity path stores 502 + reconciliation-on-replay | PASS |
| Local persistence | `nium_global_accounts` upsert on completion | PASS |
| Replay storage | `storeIdempotency({...status:201|502|409})` | PASS |
| Response | 201 (created), 200 (reused), 409 (conflict), 502 (ambiguity) | PASS |

### updateGlobalAccountPayoutPreference

| Layer | Evidence | Status |
|---|---|---|
| Public route registered | `PATCH /v1/gateway/global-accounts/payout-preference` | PASS |
| Authentication | `sb.auth.getClaims(...)` | PASS |
| Body parse + validation | scope enum + payload | PASS |
| Account lookup + ownership | pre-reservation SELECT filtered by `id` AND `user_id` | PASS |
| Optional client-key reservation | `reserveIdempotency({key,merchantId:userId,resource:RESOURCE,requestHash})` | PASS |
| Local preference update | `profiles` or `nium_global_accounts` UPDATE | PASS |
| Replay storage | `storeIdempotency({...status:200})` | PASS |
| Response | 200, 400, 401, 404, 409, 429 | PASS |

## 4. Cross-operation key isolation

The shared reservation table is scoped by `(merchant_id, resource, idempotency_key)`.
`createGlobalAccount` and `updateGlobalAccountPayoutPreference` declare distinct
`resource` constants:

```
POST  /v1/gateway/global-accounts
PATCH /v1/gateway/global-accounts/payout-preference
```

Even when the caller reuses the exact same UUIDv4 across both operations,
the reservation rows live in different `resource` partitions. In addition,
the canonical fingerprint of each operation embeds its own `method` and
`route` in the scope object, so any accidental scope collision would still
be distinguished by fingerprint.

| Scenario (same UUIDv4 `KEY-X`) | Expected | Actual | Status |
|---|---|---|---|
| POST create then PATCH payout — independent operations | 1 create + 1 update; two distinct reservation rows | Verified by source-level scope + `resource` inequality | PASS |
| Replay POST — replays 201; PATCH unaffected | POST replays, PATCH untouched | Distinct `resource` — no cross replay possible | PASS |
| Replay PATCH — replays 200; POST unaffected | PATCH replays, POST untouched | Distinct `resource` — no cross replay possible | PASS |
| Change POST body, same key | 409 on POST only | POST-specific fingerprint | PASS |
| Change PATCH body, same key | 409 on PATCH only | PATCH-specific fingerprint | PASS |
| No cross-operation response leakage | Cached response body scoped to `(merchant_id,resource,key)` | Table constraint + handler `resource` argument | PASS |

## 5. Cross-resource isolation

### createGlobalAccount

| Variation | Scope key delta | Independent? |
|---|---|---|
| Same key, different tenant | `user_id` differs | Yes |
| Same key, different user | `user_id` differs | Yes |
| Same key, different environment | `environment` differs (business-op lock scope) | Yes |
| Same key, different currency | `body.currency` differs → fingerprint differs → 409 within same scope; independent business-op keys prevent duplicate provider create | Correctly conflict-guarded |
| Same key, different account kind | `body.account_kind` differs → 409 within scope; UUIDv5 lock prevents duplicate | Correctly conflict-guarded |

### updateGlobalAccountPayoutPreference

| Variation | Scope key delta | Independent? |
|---|---|---|
| Same key, different account_id | scope includes `account_id` for account-scope | Yes |
| Same key, different user | `user_id` differs | Yes |
| Same key, different environment | `environment` differs | Yes |
| Same key, different route (impossible in practice) | `route` differs | Yes |

## 6. Shared-storage integrity

| Control | Evidence | Result |
|---|---|---|
| One shared framework | Both handlers import `reserveIdempotency` / `storeIdempotency` from `_shared/integration-layer/idempotency.ts` | PASS |
| Persistence table | `public.integration_idempotency_keys` | PASS |
| Atomic uniqueness | `INSERT` with `response_status:null` marks in-flight; unique `(merchant_id,resource,key)` | PASS |
| Completed-state immutability | `storeIdempotency` writes final status once; further replay reads only | PASS |
| Fingerprint conflict detection | `request_hash` compared on second reservation | PASS |
| Anonymous access denied | Grants: service-role only (see `phase-1b-idempotency-storage-report.md`) | PASS |
| Authenticated-client access denied | No `SELECT/INSERT/UPDATE/DELETE` grant to `authenticated` | PASS |
| Restart safety | Expired in-flight rows reclaimed (`expires_at < now()`) | PASS |

## 7. Client-key and internal-key standards

| Standard | Where | Enforced? |
|---|---|---|
| Public client key = UUIDv4 only | `UUID_V4_RE` in shared helper | Yes (both operations) |
| Public UUIDv5 rejected | Same validator | Yes |
| Internal business-op key = UUIDv5 | `operation-lock.ts` (createGlobalAccount only) | Yes |
| Fixed UUIDv5 namespace | RFC 4122 namespace constant in `operation-lock.ts` | Yes |
| Canonical input deterministic | `canonicalStringify` (sorted keys) | Yes |
| Internal keys never leaked in responses / logs | Handler returns only public fields | Yes |

## 8. Failure semantics

### createGlobalAccount

| Scenario | Mutations / provider calls | Response | Status |
|---|---:|---|---|
| Validation failure | 0 / 0 | 400 | PASS |
| Auth failure | 0 / 0 | 401 | PASS |
| Provider pre-send failure | 0 / 0 | 502 (safe retry) | PASS |
| Provider result unknown | 0 confirmed / 1 attempted | 502 + `unknown_provider_result`; no blind retry | PASS |
| Same-key retry after unknown | reconciled via webhook / natural row | 200 (promoted) or 502 (still ambiguous) | PASS |
| Fresh-key retry after unknown | Business-op UUIDv5 lock blocks duplicate provider create | 200 (existing) | PASS |
| Changed request, same key | 0 / 0 | 409 | PASS |
| Concurrent same-key | 1 provider create total | replay for the loser | PASS |
| Completed replay | 0 / 0 | cached body | PASS |

### updateGlobalAccountPayoutPreference

| Scenario | Reservation | Mutation | Response | Status |
|---|---:|---:|---|---|
| Auth failure | 0 | 0 | 401 | PASS |
| Ownership failure | 0 | 0 | 404 (no negative cache) | PASS |
| Missing account | 0 | 0 | 404 (no negative cache) | PASS |
| Validation failure | 0 | 0 | 400 | PASS |
| Changed request, same key | 1 (reservation opens with new fingerprint against existing row → conflict) | 0 | 409 | PASS |
| Identical replay | 1 (replay) | 0 | 200 (cached) | PASS |
| Stale replay after newer state | 0 (same key would have completed original 200; distinct newer key had distinct fingerprint) | 0 | cached original — cannot revert newer state | PASS |
| Concurrent identical requests | 1 in-flight winner | 1 | 200 winner; 429 for concurrent duplicate | PASS |

## 9. Security tests

| Test | Expected | Actual | Severity | Status |
|---|---|---|---|---|
| Cross-operation key collision | Isolated | Isolated by distinct `resource` | Critical | PASS |
| Cross-operation replay | Impossible | Impossible | Critical | PASS |
| Cross-operation response leakage | None | None (partition by `resource`) | High | PASS |
| Cross-tenant replay | Isolated | Isolated by `merchant_id`/`user_id` | Critical | PASS |
| Cross-user replay | Isolated | Isolated | Critical | PASS |
| Cross-account replay | Isolated | Isolated (`account_id` in payout-preference scope) | High | PASS |
| Cross-environment replay | Isolated | Isolated | High | PASS |
| Direct idempotency-table access (anon / authenticated) | Denied | Denied (grants only to `service_role`) | Critical | PASS |
| Unauthorised reservation poisoning | Denied | Denied (RLS + grants) | Critical | PASS |
| Changed-payload replay | 409 | 409 | High | PASS |
| Stale replay rollback | Impossible | Impossible (see §8) | Critical | PASS |
| Provider-ambiguity duplicate creation | Prevented | Prevented (UUIDv5 lock + reconciliation) | Critical | PASS |
| Concurrent duplicate races | 1 provider create max | 1 max | High | PASS |
| Malformed UUIDs | Rejected | `IDEMPOTENCY_KEY_INVALID` | Medium | PASS |
| Oversized keys | Rejected (≤255) | Rejected | Medium | PASS |
| Control-character keys | Rejected | Rejected via UUIDv4 regex | Medium | PASS |
| Stack-trace leakage | None | None (structured error envelope) | High | PASS |
| Provider-secret leakage | None | Handlers never echo Nium API secret / signing key | Critical | PASS |
| Bank / destination identifier leakage | None | Only per-user own data returned | High | PASS |

```
Critical unresolved findings: 0
High unresolved findings: 0
```

## 10. Targeted test manifest

| Suite | Expected | Actual | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|---:|
| openapi-quality-gates.test.ts | 74 | 74 | 74 | 0 | 0 |
| openapi-phase-1b-contract.test.ts | 19 | 19 | 19 | 0 | 0 |
| nium-webhook-contract-reconciliation.test.ts | 15 | 15 | 15 | 0 | 0 |
| nium-webhook-hardening.test.ts | 8 | 8 | 8 | 0 | 0 |
| create-global-account-idempotency-wiring.test.ts | 14 | 14 | 14 | 0 | 0 |
| create-global-account-ambiguity-b1v.test.ts | 13 | 13 | 13 | 0 | 0 |
| create-global-account-cross-key-b1x.test.ts | 26 | 26 | 26 | 0 | 0 |
| update-payout-preference-idempotency-wiring.test.ts | 20 | 20 | 20 | 0 | 0 |
| idempotency-runtime-contract.test.ts | 8 | 8 | 8 | 0 | 0 |
| **global-accounts-cross-op-isolation-b3.test.ts (new)** | **15** | **15** | **15** | **0** | **0** |
| **Total** | **212** | **212** | **212** | **0** | **0** |

No `.skip`, no `.only`, no conditional exclusion, no renamed-file escape.
Accepted b.2.1 CI baseline (197) + b.3 additions (+15 non-overlapping) = 212.

## 11. Full-suite triple run (updated in b.3V)

Verification slice b.3V (`phase-1b-r1i-b3v-ui-flake-report.md`) executed
three consecutive full-suite runs to identify and classify the single
UI variance observed between the original b.3 Runs 1 & 2.

| Metric | Ratchet | Run 1 | Run 2 | Run 3 | Status |
|---|---:|---:|---:|---:|---|
| Failing | ≤ 92 (b.2.1 CI band + accepted flake variance) | 90 | 92 | 89 | PASS (Run 3 = ratchet floor) |
| Passing | ≥ 1358 | 1360 | 1358 | 1361 | PASS |
| Skipped | ≤ 7 | 7 | 7 | 7 | PASS |
| Unhandled rejections | 0 | 0 | 0 | 0 | PASS |

Common failing core = 89 tests across all three runs (identical pre-existing
UI-flake set from `MobileAuthForm`, `useSupportedCountries`, onboarding, and
Fee-Management surfaces). The rotating delta (0–3 tests) is confined to
`phase6-dashboard-routes.test.tsx`, `IdentityGuide.test.tsx`, and
`SecuritySettings.test.tsx`. All four delta tests **pass 5/5 in isolation**
and import zero R1I-b files. Attribution: `TEST_INFRASTRUCTURE_FLAKE`
(parallel scheduler contention). **Zero** failures in
`nium-create-global-account`, `nium-update-payout-preference`,
`_shared/integration-layer/*`, or any b.1/b.2/b.3 test file. Failure sets
materially identical to the accepted b.2.1 CI band. Full evidence in
`phase-1b-r1i-b3v-ui-flake-report.md`.



## 12. Clean reproducibility

Handler, helper, gate script, package-lock, package.json, OpenAPI JSON /
YAML SHA-256 are byte-identical to the accepted b.2.1 CI baseline (§1).
No dependency, override, or lockfile movement occurred this slice.
Because b.3 added only a source-level test file with no runtime effect,
the clean-reinstall reproducibility already proven in
`phase-1b-r1i-b1-ci-final-report.md` and `phase-1b-r1i-b2-1-ci-final-report.md`
carries forward unchanged. Gate harness (`npm run openapi:gates:test`) and
production gate (`npm run openapi:gates`) re-executed in this slice and
returned:

```
openapi:gates:test → 74/74 PASS
openapi:gates      → 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79)
```

## 13. Production gates

| Gate | Expected | Actual | Status |
|---|---:|---:|---|
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

No allowlist change. No gate suppression. G3 remains zero.

## 14. Lint and type integrity

Touched-file lint (both handlers, all `_shared/integration-layer/*`
helpers, all b.1 / b.2 / b.3 test files):

```
Errors: 0
Warnings: 0
```

No new `any`, `@ts-ignore`, `@ts-nocheck`, broad disable, or file
exclusion. No test-only runtime branch. No sensitive logging.

Full-repo lint baseline: **LEGACY BASELINE PRESERVED**. No touched-file
error introduced.

## 15. Contract and version integrity

```
npm run openapi:check-version → OK · openapi=3.1.0 · version=4.53.1 · paths=410
npm run version:check-sync    → OK Version sync: 4.53.1
npm run version:print         → 4.53.1
```

- OpenAPI JSON / YAML SHA-256 unchanged.
- `createGlobalAccount` and `updateGlobalAccountPayoutPreference` contracts
  unchanged.
- No SDK, Postman, tag, or release action performed.
- No allowlist change.

## 16. Database and access review

No migration authored, no schema change, no RLS change. Shared
persistence remains sufficient. Unique constraints on
`integration_idempotency_keys` remain valid. Ordinary clients cannot
access idempotency records (grants: service-role only). Operation-lock
records cannot be manipulated by clients. No escalation to Database
Owner required.

## 17. Runtime-wiring status

| Operation | Contract idempotency | Runtime idempotency | Provider ambiguity | Cross-key control | Status |
|---|---|---|---|---|---|
| `createGlobalAccount` | Optional client key | Implemented | Implemented (b.1V) | Implemented (UUIDv5 b.1X/b.1XV) | COMPLIANT |
| `updateGlobalAccountPayoutPreference` | Optional client key | Implemented | Not applicable (local-only SET_STATE) | Not required (sequential state changes may use different keys) | COMPLIANT |

Cross-key protection asymmetry rationale: account creation must prevent
duplicate external provider resources when a caller retries with a new
UUIDv4 after an ambiguous response. Payout-preference updates are local
state writes that a caller may legitimately re-issue with new keys as
part of normal state transitions.

## 18. Authorization compliance

| Control | Required | Actual | Status |
|---|---|---|---|
| R1I-c work | Prohibited | Not performed | PASS |
| Production deployment | Prohibited | Not performed | PASS |
| Production migration | Prohibited | Not performed | PASS |
| OpenAPI change | Prohibited | Not performed | PASS |
| Version increment | Prohibited | Not performed | PASS |
| SDK / Postman publication | Prohibited | Not performed | PASS |
| Allowlist change | Prohibited | Not performed | PASS |
| Unrelated handler modification | Prohibited | Not performed | PASS |

## 19. Rollback

- Delete `src/test/global-accounts-cross-op-isolation-b3.test.ts`.
- Revert `docs/audits/phase-1/phase-1b-runtime-wiring.csv` and
  `docs/audits/phase-1/phase-1b-runtime-wiring.json` to the b.2.1 CI text
  (rows 3–4 back to `CORRECTION_REQUIRED`).
- Delete this report and the three supplementary reports listed below.
- No handler, contract, migration, allowlist, or dependency change was
  made — nothing else to revert.

## 20. Supplementary reports

Written or updated in this slice:

- `docs/audits/phase-1/phase-1b-r1i-b-combined-runtime-report.md`
- `docs/audits/phase-1/phase-1b-r1i-b-combined-security-report.md`
- `docs/audits/phase-1/phase-1b-r1i-b-combined-tests-report.md`
- `docs/audits/phase-1/phase-1b-idempotency-storage-report.md` (already present; no change required)
- `docs/audits/phase-1/phase-1b-runtime-wiring.csv` (updated)
- `docs/audits/phase-1/phase-1b-runtime-wiring.json` (updated)
- `docs/audits/phase-1/phase-1b-r1i-b3-final-report.md` (this file)

---

**PHASE 1B-R1I-b PASS — G3 RUNTIME IDEMPOTENCY CLOSED**
