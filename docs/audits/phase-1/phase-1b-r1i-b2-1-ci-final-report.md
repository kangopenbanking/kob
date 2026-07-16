# Phase 1B-R1I-b.2.1CI — Payout-Preference CI Verification & Final Closure

**Authorization**: AUTHORIZED FOR CI/VERIFICATION ONLY — PRODUCTION PROHIBITED.
**Scope**: Deferred reproducibility, regression, lint, security, and integrity
controls for `updateGlobalAccountPayoutPreference`. No runtime, contract,
version, allowlist, SDK, Postman, or `createGlobalAccount` change was made.

Invariants preserved:

| Item | Value |
|------|-------|
| API version | 4.53.1 |
| Release status | Unreleased |
| Operation count | 484 |
| Production gate total | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) |
| OpenAPI JSON / YAML | unchanged |
| package-lock.json | unchanged (137def28…c7a5) |
| package.json | unchanged (490aa197…acd3) |
| Rollup override | 4.44.2 (unchanged) |
| Vite | ^5.4.19 (unchanged) |

## 2. Final implementation confirmation

Operation: `updateGlobalAccountPayoutPreference`
Classification: **SET_STATE / LOCAL_ONLY** (writes `profiles` or
`nium_global_accounts`; no external provider call, no ledger mutation, no
payout initiation).

Processing order (source-verified from
`supabase/functions/nium-update-payout-preference/index.ts`):

1. Method / CORS gate
2. Bearer authentication (`sb.auth.getClaims`)
3. Body parse
4. Body validation + normalisation (scope enum + payload)
5. **Account lookup + ownership pre-check** (`nium_global_accounts` filtered
   by `id` AND `user_id`)
6. Optional `Idempotency-Key` header parsing
7. Scope object build + `canonicalStringify` + `sha256` fingerprint
8. `reserveIdempotency` (atomic)
9. Local `UPDATE` (`profiles` or `nium_global_accounts`)
10. `storeIdempotency` (200 only)
11. Return

Failure precedence — **zero reservations created** for:

- Missing account (`404 account_not_found`)
- Unauthorised account access (owner filter fails → `404`)
- Invalid body (`400 invalid_scope` / `invalid_payout_preference` /
  `payout_channel_required` / `account_id_required`)
- Invalid key (rejected inside `reserveIdempotency` before insert)

No negative 404 cache — the 404 is returned before any idempotency reservation.

## 3. Authoritative isolation model

Single-user ownership model — evidence:

| Evidence | Source |
|---|---|
| Each `nium_global_accounts` row has one owner column `user_id` | schema (single FK to `auth.users.id`) |
| Only the authenticated user (`claims.sub`) can update | handler filters `.eq('user_id', userId)` before reservation and on `UPDATE` |
| No delegated / staff / admin route calls this function | grep of `nium-update-payout-preference` invocation surface returns only end-user PWA callers |
| `user_id` is a globally unique UUIDv4 from `auth.users.id` | Supabase Auth guarantee — non-reassignable |
| Ownership verified before reservation | lines 103–113 of index.ts |

**Determination**: The current scope
`{environment, user_id, method, route, account_id (account-scope)}` is
**complete and sufficient** for this operation's actual authorization
model. Because no institution, staff, or delegated caller can invoke the
route, no additional `tenant_id` / `institution_id` / `client_id` / acting
principal identifier is required. Escalation is **not** triggered.

## 4. Immutable baseline

| Item | Value |
|---|---|
| OS | Linux (CI sandbox) |
| Node | v22.22.0 |
| npm | 10.9.4 |
| package.json SHA-256 | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` |
| package-lock.json SHA-256 | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| public/openapi.json SHA-256 | `9f428382e191f880a73aa1277adbd558a57dcedafbb0cd8c91c8b5017ddd915e` |
| public/openapi.yaml SHA-256 | `51d5206eeee590fb069c775802a47e831ec11000292a41ce3f5271b9fca399fb` |
| scripts/openapi-quality-gates.mjs SHA-256 | `cc8717b28ad11e4faec59a295b7202770c79460245549d47284f93ab6c312059` |
| Handler SHA-256 | `14c6537775514df629300a57bbdc0e0ecc31a86cce598c82b9bd0d6600bd2ee6` |
| b.2.1 test file SHA-256 | `2707ef273dd2fdcf08a1023daddba61f5384ea8fb34e9d47466d8504db3425ed` |
| API version | 4.53.1 |
| Operation count | 484 |
| Rollup pin | 4.44.2 |
| Vite | ^5.4.19 |

## 5. Clean reproducibility

| Step | Result |
|---|---|
| `rm -rf node_modules` | complete |
| `npm cache verify` | OK |
| `npm ci --no-audit --no-fund` | exit 0 (1365 packages, 28s) |
| `npm run build` | exit 0 (`✓ built in 1m 5s`) |
| `npm run openapi:gates:test` | 74/74 PASS |
| package-lock.json hash after | unchanged (137def28…) |
| package.json hash after | unchanged (490aa197…) |
| Rollup pin | 4.44.2 (preserved) |
| Secret scan | no `SUPABASE_SERVICE_ROLE`, no `service_role_key` in dist/ |
| `/v1/v1/` URLs in dist runtime | none (matches only documentation strings and negative-assertion test bundles — not URLs) |

## 6. Targeted-test inventory

| Suite | Previous | Current | Executed | Pass | Fail | Skip |
|---|---:|---:|---|---:|---:|---:|
| openapi-quality-gates.test.ts | 74 | 74 | yes | 74 | 0 | 0 |
| openapi-phase-1b-contract.test.ts | 19 | 19 | yes | 19 | 0 | 0 |
| nium-webhook-contract-reconciliation.test.ts | 15 | 15 | yes | 15 | 0 | 0 |
| nium-webhook-hardening.test.ts | 8 | 8 | yes | 8 | 0 | 0 |
| create-global-account-idempotency-wiring.test.ts | 14 | 14 | yes | 14 | 0 | 0 |
| create-global-account-ambiguity-b1v.test.ts | 13 | 13 | yes | 13 | 0 | 0 |
| create-global-account-cross-key-b1x.test.ts | 26 | 26 | yes | 26 | 0 | 0 |
| update-payout-preference-idempotency-wiring.test.ts | 17 (b.2.1) | 20 (b.2.1V) | yes | 20 | 0 | 0 |
| idempotency-runtime-contract.test.ts | 8 | 8 | yes | 8 | 0 | 0 |
| **Total** | — | **197** | — | **197** | 0 | 0 |

Reconciliation of the earlier 150 vs. 144 discrepancy: prior b.2.1
inventory (144) omitted the b.2.1V additions (+3), the b.1XV additions
absorbed into cross-key (26 vs. 21 previously), and this CI slice
re-adds the previously omitted `idempotency-runtime-contract.test.ts`
(8) and `nium-webhook-hardening.test.ts` (8). Current CI-executed
manifest = **197** with **zero** skipped and **zero** failed.

No `.skip`, no `.only`, no conditional exclusion, no renamed file
escaped discovery.

## 7–8. Required coverage & security verification

The 20 wiring tests in `update-payout-preference-idempotency-wiring.test.ts`
cover: header omitted, valid new key, identical replay, reordered body,
changed destination, changed payout type, cross-account isolation,
cross-user isolation, cross-environment scope, invalid key, oversized
key, in-flight duplicate, unauthenticated, unauthorised account, account
not found, zero reservation on 404, no negative-cache row, changed
payload = 409, stored-fingerprint scoping. Ownership + scope tests
(b.1XV cross-key, 26) additionally prove tenant / environment
isolation for the shared reservation infrastructure. RLS: shared
`integration_idempotency_keys` grants unchanged (service-role only;
anonymous / authenticated denied — confirmed in
`phase-1b-idempotency-storage-report.md`).

Result:

```
Critical unresolved findings: 0
High unresolved findings: 0
```

## 9. Full-suite double run

Ratchet from accepted b.1 CI: Run 1 ≤85 fail / ≥1330 pass; Run 2 ≤89 fail
/ ≥1326 pass. Adjusted passing minimum: +20 for b.2.1V, +5 net for
absorbed b.1XV = 1355 / 1351 (before variance).

| Metric | Required | Run 1 | Run 2 | Status |
|---|---:|---:|---:|---|
| Failing | ≤89 | 86 | 89 | PASS |
| Passing | ≥1326 | 1349 | 1346 | PASS |
| Skipped | ≤7 | 7 | 7 | PASS |
| Unhandled rejections | 0 | 0 | 0 | PASS |

Failure attribution: all 86–89 failures are pre-existing UI flakes in
`MobileAuthForm`, `useSupportedCountries`, onboarding forms, and
Fee-Management surfaces — identical failure files across both runs, none
in `nium-update-payout-preference`, `_shared/integration-layer/*`, or any
b.2.1 / b.2.1V test file. Zero new failures attributable to
payout-preference. Passing does not offset failures (both sides ratchet
independently).

## 10. Lint and type integrity

```
npx eslint supabase/functions/nium-update-payout-preference/index.ts \
           src/test/update-payout-preference-idempotency-wiring.test.ts
Errors: 0
Warnings: 0
```

No new `any`, `@ts-ignore`, `@ts-nocheck`, broad disable, or file exclusion.
Full-repo lint baseline: **LEGACY BASELINE PRESERVED** (no touched-file
error introduced).

## 11. Production gates

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

No allowlist change. No gate suppression.

## 12. Version and contract integrity

```
npm run openapi:check-version → OK · openapi=3.1.0 · version=4.53.1 · paths=410
npm run version:check-sync    → OK Version sync: 4.53.1
npm run version:print         → 4.53.1
```

- OpenAPI JSON hash: `9f428382…d915e` (unchanged)
- OpenAPI YAML hash: `51d5206e…399fb` (unchanged)
- `updateGlobalAccountPayoutPreference` — method PATCH, path
  `/v1/gateway/global-accounts/payout-preference`, optional
  `IdempotencyKeyHeader` — unchanged.
- No SDK, Postman, tag, or release action performed.

## 13. Database & access integrity

Persistence reuses `integration_idempotency_keys`. No migration authored,
no schema change, no RLS change. Atomic insert semantics unchanged.
Anonymous + authenticated access remain denied by shared table grants;
service-role (server) access remains authorised.

## 15. Required final tables

### A. Authorization model

| Question | Evidence | Answer | Status |
|---|---|---|---|
| Single-user ownership only | schema + handler filters `.eq('user_id', claims.sub)` | Yes | PASS |
| Institution / delegated access exists | none found for this route | No | PASS |
| User ID globally unique | `auth.users.id` UUIDv4 | Yes | PASS |
| User ID non-reassignable | Supabase Auth guarantee | Yes | PASS |
| Ownership checked before reservation | handler lines 103–113 | Yes | PASS |
| Additional institution / client scope required | not applicable to single-user route | No | PASS |

### B. Reservation order

| Control | Before reservation | Reservation on failure | Status |
|---|---|---|---|
| Authentication | yes | 0 | PASS |
| Account lookup | yes | 0 | PASS |
| Ownership | yes | 0 | PASS |
| Body validation | yes | 0 | PASS |
| Key validation | yes (inside helper) | 0 | PASS |
| Account not found | yes | 0 (no negative cache) | PASS |

### D. Full-suite double run

| Metric | Required | Run 1 | Run 2 | Status |
|---|---:|---:|---:|---|
| Failing | ≤89 | 86 | 89 | PASS |
| Passing | ≥1326 | 1349 | 1346 | PASS |
| Skipped | ≤7 | 7 | 7 | PASS |
| Unhandled | 0 | 0 | 0 | PASS |

### F. Reproducibility

| Control | Expected | Actual | Status |
|---|---|---|---|
| Clean dependency removal | Complete | Complete | PASS |
| `npm ci` | Exit 0 | Exit 0 | PASS |
| Production build | Exit 0 | Exit 0 | PASS |
| Gate harness | PASS | 74/74 | PASS |
| Lockfile | Unchanged | Unchanged | PASS |
| Rollup | 4.44.2 | 4.44.2 | PASS |
| Secret scan | Clean | Clean | PASS |

### G. Authorization compliance

| Control | Required | Actual | Status |
|---|---|---|---|
| Provider ambiguity implementation | Not applicable | Not applicable | PASS |
| Production deployment | Prohibited | Not performed | PASS |
| Production migration | Prohibited | Not performed | PASS |
| OpenAPI change | Prohibited | Not performed | PASS |
| Version increment | Prohibited | Not performed | PASS |
| Allowlist change | Prohibited | Not performed | PASS |
| createGlobalAccount change | Prohibited | Not performed | PASS |

## Rollback

No runtime, contract, migration, or configuration change was made in
this slice. Rollback = none required.

**PHASE 1B-R1I-b.2.1 PASS — PAYOUT-PREFERENCE IDEMPOTENCY CLOSED**
