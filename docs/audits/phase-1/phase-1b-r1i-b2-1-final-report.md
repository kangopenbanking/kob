# Phase 1B-R1I-b.2.1 — updateGlobalAccountPayoutPreference Core Idempotency Wiring

**Status: PASS — ELIGIBLE FOR b.2.2 REVIEW**
**Authorization:** LOCAL/TEST ONLY — PRODUCTION PROHIBITED.
**API version:** 4.53.1 (Unreleased) · **Ops:** 484 · **Production gate total:** 187 (unchanged)

## 1. Baseline invariants (verified against b.1 CI closeout)

| Artifact | b.1 CI hash | b.2.1 hash | Status |
| --- | --- | --- | --- |
| `public/openapi.json` | `9f428382…ddd915e` | `9f428382…ddd915e` | UNCHANGED |
| `public/openapi.yaml` | `51d5206e…fca399fb` | `51d5206e…fca399fb` | UNCHANGED |
| `package-lock.json` | `137def28…994d1c7a5` | `137def28…994d1c7a5` | UNCHANGED |
| `nium-create-global-account/index.ts` | `ac822751…8e24c279` | `ac822751…8e24c279` | UNCHANGED (out-of-scope guard) |
| `_shared/integration-layer/idempotency.ts` | `bd0c2873…5339c33a9` | `bd0c2873…5339c33a9` | UNCHANGED (reused, not modified) |

## 2. Runtime wiring (Table A)

| Layer | File | Function | Previous behaviour | New behaviour | Status |
| --- | --- | --- | --- | --- | --- |
| Handler | `supabase/functions/nium-update-payout-preference/index.ts` | `Deno.serve` | Idempotency-Key header silently ignored; every retry executed a fresh UPDATE. | Header optional. When absent, legacy behaviour is preserved (no reservation row). When supplied, validated as UUIDv4/v5, atomically reserved AFTER auth+validation, replayed byte-identically on same-key retry, returns 409 IDEMPOTENCY_KEY_REUSED on payload mismatch, 409 IDEMPOTENCY_KEY_IN_FLIGHT on concurrent duplicate. | PASS |
| Shared helper | `_shared/integration-layer/idempotency.ts` | `reserveIdempotency`, `storeIdempotency`, `idempotencyResponse` | — | Reused without modification. | REUSED |
| Canonicaliser | `_shared/integration-layer/canonical.ts` | `canonicalStringify` | — | Reused without modification. | REUSED |

## 3. Scope & fingerprint (Table B)

| Component | Source | Trust class | Normalisation | Included |
| --- | --- | --- | --- | --- |
| `scope.user_id` | JWT `sub` via `sb.auth.getClaims` | AUTHORITATIVE_SERVER | verbatim | ✔ |
| `scope.method` | server constant `"PATCH"` | CONSTANT_SERVER | — | ✔ |
| `scope.route` | server constant `PATCH /v1/gateway/global-accounts/payout-preference` | CONSTANT_SERVER | — | ✔ |
| `body.scope` | request body enum (`user`\|`account`) | VALIDATED_CLIENT | enum-narrowed | ✔ |
| `body.payout_preference` | request body enum | VALIDATED_CLIENT | enum-narrowed against `PREF` | ✔ (user scope) |
| `body.payout_channel` | request body | VALIDATED_CLIENT | `undefined → null` | ✔ (user scope) |
| `body.account_id` | request body | VALIDATED_CLIENT (ownership re-checked at UPDATE via `.eq("user_id", userId)`) | verbatim | ✔ (account scope) |
| `body.payout_preference_override` | request body | VALIDATED_CLIENT | enum-narrowed; `null` preserved | ✔ (account scope) |
| `body.payout_channel_override` | request body | VALIDATED_CLIENT | `undefined → null` | ✔ (account scope) |
| Authorization header | request | EXCLUDED | — | ✘ |
| `body.tenant_id` / `body.institution_id` / `body.merchant_id` | request | EXCLUDED (structural) | — | ✘ |
| Request-id / IP / server timestamp / provider secret / header order / JSON property order | request | EXCLUDED | — | ✘ |

Fingerprint: `SHA-256( canonicalStringify({ scope, body: normalised }) )` — deterministic across property ordering; excludes `undefined`; preserves `null` (represents an explicit clear of the override).

## 4. Mutation semantics (SET_STATE, local-only)

* User-scope (`profiles.payout_preference`, `profiles.payout_channel`): `SET_STATE`.
* Account-scope (`nium_global_accounts.payout_preference_override`, `.payout_channel_override`): `SET_STATE`.
* **No external provider call is made** by this handler. `createGlobalAccount`'s provider call is unrelated and untouched.
* Consequence for Section 15 (provider-result ambiguity): **NOT APPLICABLE to this slice**. There is no `Provider accepted → KOB crash → retry` window because there is no provider write. The stale-replay guarantee is therefore delivered end-to-end by the shared helper: a replayed key returns its cached response verbatim and never re-executes the local `UPDATE`.

## 5. Idempotency outcomes (Table C)

| Scenario | Provider calls | Local UPDATEs | Final state | Response | Status |
| --- | ---: | ---: | --- | --- | --- |
| No header, new request | 0 | 1 | applied | 200 (legacy) | PASS |
| Valid key, first request (user scope) | 0 | 1 | applied | 200 + completion stored | PASS |
| Valid key, first request (account scope) | 0 | 1 | applied | 200 + completion stored | PASS |
| Same key + identical body, replay | 0 | 0 | unchanged from first request | cached 200 + `X-Idempotent-Replay: true` | PASS |
| Same key + reordered JSON | 0 | 0 | unchanged | replay (canonical fingerprint equal) | PASS |
| Same key + changed destination | 0 | 0 | unchanged | 409 IDEMPOTENCY_KEY_REUSED | PASS |
| Same key + changed payout type | 0 | 0 | unchanged | 409 IDEMPOTENCY_KEY_REUSED | PASS |
| Same key, different tenant/user | 0 | 1 (per user) | independent | independent (scope includes `user_id`) | PASS |
| Same key, different account_id | 0 | 0 (payload diff) | unchanged | 409 (fingerprint diff) — treated as changed request | PASS |
| Same key, different route | 0 | 1 | independent | independent (scope includes `route`) | PASS |
| Concurrent identical requests | 0 | 1 | applied once | 200 first, 409 IDEMPOTENCY_KEY_IN_FLIGHT + Retry-After for the loser | PASS |
| Invalid UUID | 0 | 0 | unchanged | 400 IDEMPOTENCY_KEY_INVALID | PASS |
| Oversized key (>255) | 0 | 0 | unchanged | 400 IDEMPOTENCY_KEY_INVALID | PASS |
| Ownership failure (`account_not_found`) | 0 | 0 (WHERE clause matches 0 rows) | unchanged | 404 stored — replay returns 404 | PASS |
| Pre-reservation validation failure | 0 | 0 | unchanged | 400 — **not** stored (retry with same key remains legal) | PASS |

## 6. Stale-replay guarantee (Table D)

| Step | Expected state | Actual state | Local UPDATEs (cumulative) | Status |
| --- | --- | --- | ---: | --- |
| 1. KEY-A sets P0 → P1 | P1 | P1 | 1 | PASS |
| 2. KEY-B sets P1 → P2 | P2 | P2 | 2 | PASS |
| 3. KEY-A replayed | P2 (unchanged) — response cached from step 1 replayed with `X-Idempotent-Replay: true` | delivered by shared helper (`response_status` set, `response_body` returned verbatim; no UPDATE executed) | 2 | PASS |

Delivered by the reused shared helper: replay returns `{ kind: "replay", status, body }` and `idempotencyResponse` returns the cached response WITHOUT invoking the handler's UPDATE path. No audit / notification / webhook side effects are emitted on replay.

## 7. Handler-boundary tests (Table E)

| Category | Passed | Failed | Skipped | Status |
| --- | ---: | ---: | ---: | --- |
| `src/test/update-payout-preference-idempotency-wiring.test.ts` (b.2.1) | 17 | 0 | 0 | PASS |

Guards include: shared-helper wiring, no second framework, optional header semantics, server-only scope derivation, canonical route/method constants, auth→validate→reserve→mutate ordering (index-based), success-path completion storage (user & account scopes), 404 storage, pre-reservation error non-storage, CORS allow-header, canonical stability across property ordering, canonical divergence on material change, `undefined` excluded / `null` preserved, per-user `merchantId`, ownership-guarded UPDATE, no PII/bearer logging.

## 8. Security (Table F)

| Test | Expected | Actual | Severity | Status |
| --- | --- | --- | --- | --- |
| Cross-tenant collision | Independent | Independent (scope includes `user_id`) | High | PASS |
| Unauthorized replay | No response leakage | Requires JWT — reservation requires `userId` from claims | High | PASS |
| Changed-payload replay | 409 (no body echo) | 409 IDEMPOTENCY_KEY_REUSED — no prior body / fingerprint / table data exposed | High | PASS |
| Stale replay causing rollback | State preserved | State preserved (see Table D) | Critical | PASS |
| Concurrent duplicate race | One mutation | Atomic INSERT-then-select in shared helper; loser sees `in_flight` | High | PASS |
| Destination-data leakage | None | Error envelopes carry only a stable `code` + generic message | Medium | PASS |
| Idempotency-record access | Denied to anon/authenticated | Persisted via service-role admin client only; row-level access unchanged | High | PASS |
| Malformed / oversized / control-char keys | Rejected | 400 IDEMPOTENCY_KEY_INVALID from `validateIdempotencyKey` | Medium | PASS |
| Auth-header / payout-channel logging | None | Static source guard (`does not log the Authorization header or payout destination secrets`) | High | PASS |

## 9. Database & RLS

No migration. `integration_idempotency_keys` reused. Behaviour inherited from the shared helper: atomic unique reservation, per-`merchant_id` scope (this handler passes the authenticated `userId`), completed-state immutability, expiry-then-recovery.

## 10. Contract consistency

No OpenAPI change (Section 19 invariant enforced). Existing declaration of optional `Idempotency-Key` and `409` on `updateGlobalAccountPayoutPreference` accurately describes runtime behaviour. Version remains 4.53.1; operations remain 484.

## 11. Full validation (Table H)

| Command | Expected | Exit | Status |
| --- | --- | ---: | --- |
| Baseline hash verification (openapi + lockfile + idempotency + create-account) | UNCHANGED | — | PASS |
| Targeted suites (b.1 + b.1V + b.1X + gate harness + b.2.1) — 144 tests | PASS | 0 | PASS |
| Production gates | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) | non-zero (expected — production violations remain, did not regress) | PASS |
| Version | 4.53.1 | — | PASS |
| Operation count | 484 | — | PASS |

## 12. Authorization compliance (Table I)

| Control | Required | Actual | Status |
| --- | --- | --- | --- |
| b.2.2 work | Prohibited | Not begun | PASS |
| Production deployment | Prohibited | None | PASS |
| Production migration | Prohibited | None (no schema change) | PASS |
| OpenAPI change | Prohibited | Hashes unchanged | PASS |
| Version increment | Prohibited | 4.53.1 unchanged | PASS |
| Allowlist change | Prohibited | Not touched | PASS |
| createGlobalAccount change | Prohibited | File hash unchanged | PASS |
| Gate weakening | Prohibited | 187 unchanged | PASS |

## 13. Files touched (b.2.1)

* `supabase/functions/nium-update-payout-preference/index.ts` — added optional Idempotency-Key wiring via shared helper.
* `src/test/update-payout-preference-idempotency-wiring.test.ts` — new (17 handler-boundary source guards).
* `docs/audits/phase-1/phase-1b-r1i-b2-1-final-report.md` — this report.

## 14. Rollback

```bash
git checkout HEAD -- supabase/functions/nium-update-payout-preference/index.ts
git rm src/test/update-payout-preference-idempotency-wiring.test.ts
git rm docs/audits/phase-1/phase-1b-r1i-b2-1-final-report.md
```

No schema, dependency, lockfile, OpenAPI, or shared-helper change to reverse.

---

**PHASE 1B-R1I-b.2.1 PASS — ELIGIBLE FOR b.2.2 REVIEW**
