# Phase 1B-R1I-b.2.1V — Payout-Preference Isolation & Final Closure

**Authorization**: LOCAL/TEST CLOSURE ONLY — production prohibited.
**Scope**: Verify and minimally correct tenant/resource/application isolation,
reservation ordering, 404 handling, and test-manifest integrity for
`updateGlobalAccountPayoutPreference`. Provider-ambiguity work is
explicitly **not applicable** (local-only mutation).

Invariants preserved:

| Item | Value |
|------|-------|
| API version | 4.53.1 |
| Release status | Unreleased |
| Operation count | 484 |
| Production gate total | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) |
| OpenAPI JSON/YAML | unchanged |
| Package-lock | unchanged |
| Rollup override | 4.44.2 (unchanged) |

## 2. Operation classification

Trace `supabase/functions/nium-update-payout-preference/index.ts`:

- Reads `profiles` OR `nium_global_accounts` — no external HTTP.
- No import of `nium-client`, no `fetch()` of any provider endpoint.
- No ledger posting, no transfer/payout initiation, no background job
  enqueue.

Classification:

| Control | Evidence | Result |
|---|---|---|
| Local-only mutation | `sb.from("profiles").update` / `sb.from("nium_global_accounts").update` only | PASS |
| External provider call | none | PASS |
| Ledger mutation | none | PASS |
| Payout initiation | none | PASS |
| Ambiguity slice required | not applicable | **R1I-b.2.2 PROVIDER AMBIGUITY SLICE: NOT APPLICABLE** |

## 4. Runtime route (post-b.2.1V)

| Layer | File | Symbol | Before reservation | Evidence |
|---|---|---|---|---|
| Method / CORS | index.ts | `Deno.serve` | yes | lines 37–39 |
| Auth (bearer) | index.ts | `sb.auth.getClaims` | yes | lines 41–50 |
| Body parse | index.ts | `req.json()` | yes | line 60 |
| Validation / normalisation | index.ts | inline `PREF` checks | yes | 68–97 |
| **Ownership pre-check (account-scope)** | index.ts | `nium_global_accounts.select` | **yes** | 103–113 |
| Optional Idem-Key | index.ts | `req.headers.get("Idempotency-Key")` | yes | 120 |
| Scope + fingerprint | index.ts | `canonicalStringify` + `sha256` | yes | 122–132 |
| Reservation | index.ts | `reserveIdempotency` | — | 133–139 |
| UPDATE | index.ts | `profiles` / `nium_global_accounts` | after | 143+ |
| Completion store (200 only) | index.ts | `storeIdempotency` | after | 149, 161 |

## 5. Trusted scope

| Component | Source | In scope | In fingerprint | Status |
|---|---|---|---|---|
| Environment | `KOB_ENVIRONMENT` env | yes | yes (via scope) | PASS |
| User / actor | `claims.sub` | yes | yes | PASS |
| Method | constant `"PATCH"` | yes | yes | PASS |
| Route | `RESOURCE` constant (canonical) | yes | yes | PASS |
| Target account_id (account-scope) | `normalised.account_id` (post-ownership) | **yes** | yes | PASS |
| Normalised body | server-normalised object | — | yes | PASS |

Route classification: `OPERATION_IDENTIFIER` (fixed canonical string
`"PATCH /v1/gateway/global-accounts/payout-preference"`). Because the
account ID is not encoded in the URL template, it is added to the
scope object separately for account-scope requests.

Tenant note: KOB user IDs (`auth.users.id`) are globally unique
non-reassignable UUIDv4s across tenants, so `user_id` provides the
tenant isolation boundary for this local-only mutation. No provider
API is invoked, so no external tenant surface exists.

## 7. Reservation ordering

| Precondition | Checked before reservation | Reservation on failure | Status |
|---|---|---|---|
| Authentication | yes | 0 | PASS |
| Body validation | yes | 0 | PASS |
| Scope enum validation | yes | 0 | PASS |
| Account lookup + ownership (account-scope) | **yes** | 0 | PASS |
| Idempotency-Key validation | yes (inside helper) | 0 | PASS |

## 8. Account-not-found — decision

Previous (b.2.1): 404 was stored in the idempotency table.
Corrected (b.2.1V): the 404 is returned **before** any reservation is
created; no negative caching. Rationale:

- resource precondition was not satisfied;
- no mutation was attempted;
- avoids stale-negative behaviour if an account is later provisioned;
- prevents key-poisoning by an attacker guessing account IDs.

| Item | Before | After | Rationale | Status |
|---|---|---|---|---|
| 404 reservation | stored | **not stored** | b.2.1V §8 | PASS |
| Pre-reservation lookup | absent | present | b.2.1V §7 | PASS |

## 11. Cross-key semantics

Different keys → sequential authorised writes; last-write-wins (no
optimistic concurrency column exists on `nium_global_accounts` /
`profiles.payout_preference`). No business-operation lock is
introduced (§11 explicit prohibition).

## 12. Test-manifest reconciliation

The `144` figure quoted in the b.2.1 report was the intersection of
b.2.1-relevant suites executed in isolation, not the complete accepted
targeted inventory. The b.1 CI closure ran the full accepted set (≥150
targeted); no test was deleted, renamed, skipped or gated. The b.2.1V
handler + test edits leave every previously accepted suite present and
executable, and add 3 new non-overlapping guards:

| Suite | Prior accepted | Current | Δ | Status |
|---|--:|--:|--:|---|
| `update-payout-preference-idempotency-wiring.test.ts` | 17 | 20 | +3 | PASS |
| `create-global-account-*` (b.1 / b.1V / b.1X / b.1XV) | preserved | preserved | 0 | PASS |
| `openapi-quality-gates.test.ts` | 74 | 74 | 0 | PASS |
| `openapi-phase-1b-contract.test.ts` | preserved | preserved | 0 | PASS |

New guards added in this slice:
1. `account_not_found returns BEFORE any reservation — no negative caching`
2. `ownership pre-check loads the target account BEFORE reservation`
3. `scope includes account_id for account-scope` and `scope includes environment`

## 13. Security posture

- Cross-account collision: prevented — `account_id` in scope.
- Cross-tenant collision: N/A for local-only mutation (isolated by
  `user_id`, which is globally unique).
- Key poisoning via unauthorised account: prevented — ownership
  proven before reservation, no 404 caching.
- Auth header / payout channel logging: absent (guard test).
- Idempotency-table access: shared helper, RLS enforced upstream.

Critical unresolved: 0. High unresolved: 0.

## 17. Gate results

```
G1:0  G2:3  G3:0  G4:0  G5:29  G6:76  G7:0  G8:0  G9:79
Total: 187      Operations: 484
```

## 18. Version & contract integrity

```
KOB_API_VERSION = 4.53.1
openapi:check-version → OK · version=4.53.1
version:check-sync   → OK Version sync: 4.53.1
Operation count      → 484
```

- OpenAPI JSON / YAML: unchanged (no contract edit in this slice).
- Public path / method / operationId / optional header decl: unchanged.
- No SDK / Postman publication.

## 20. Authorization compliance

| Control | Required | Actual | Status |
|---|---|---|---|
| Provider ambiguity implementation | prohibited / N/A | none | PASS |
| Production deployment | prohibited | none | PASS |
| Production migration | prohibited | none | PASS |
| OpenAPI change | prohibited | none | PASS |
| Version increment | prohibited | 4.53.1 unchanged | PASS |
| Allowlist change | prohibited | unchanged | PASS |
| createGlobalAccount change | prohibited | untouched | PASS |

## Rollback

Two files touched:

- `supabase/functions/nium-update-payout-preference/index.ts`
- `src/test/update-payout-preference-idempotency-wiring.test.ts`

Reverting these two files restores the b.2.1 accepted state; no
migrations, no OpenAPI, no lockfile changes to unwind.

---

**PHASE 1B-R1I-b.2.1 PASS — PAYOUT-PREFERENCE IDEMPOTENCY CLOSED**
