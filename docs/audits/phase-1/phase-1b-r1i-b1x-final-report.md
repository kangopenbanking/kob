# Phase 1B-R1I-b.1X — Cross-Key Global-Account Duplicate Protection

**Status:** PASS (local/test)
**API version:** 4.53.1 (Unreleased) — unchanged
**Operations:** 484 — unchanged
**OpenAPI:** unchanged (no contract change)
**Migration:** none (reuses existing `integration_idempotency_keys`)

---

## 1. Risk closed

Before b.1X, an identical logical operation (`user_id + provider + currency +
account_kind`) submitted under a **different** `Idempotency-Key` while the
first attempt's provider result was still unknown (b.1V ambiguity, or webhook
race) could trigger a **second** `createGlobalAccount` provider call, because:

- b.1 idempotency scope is per-client-key.
- The `nium_global_accounts` natural check only fires after the local row
  exists, which requires a successful provider response or webhook arrival.

## 2. Solution — Business-operation lock over existing infrastructure

**No new framework. No schema change. No migration.**

A second, server-derived idempotency slot is reserved BEFORE the provider call
using a UUID v4 deterministically computed from a trusted scope:

```
scope = { provider: "nium", resource: "global_account",
          user_id, currency, account_kind }
opKey = uuidV4(sha256(canonicalStringify(scope)))
opResource = "op:" + RESOURCE
```

The same shared `reserveIdempotency` / `storeIdempotency` helpers (Phase 5a
hardened) provide atomic INSERT semantics against `integration_idempotency_keys`.
Two concurrent fresh keys for the same scope race on a single row; the loser
receives `in_flight`. Once one attempt records a result (success or
ambiguity), every subsequent fresh-key attempt hits `replay` and is routed
through reconciliation against `nium_global_accounts` — the provider is never
re-invoked from that path.

## 3. State behaviour

| Op-lock outcome | Provider create allowed | Behaviour |
| --- | --- | --- |
| `miss` | yes | Normal path (single owner) |
| `in_flight` | **no** | 409 `GLOBAL_ACCOUNT_OPERATION_IN_PROGRESS` + Retry-After |
| `replay` + local row present | no | Return existing account (200, `cross_key_reconciled: true`) |
| `replay` + no local row | **no** | 409 `GLOBAL_ACCOUNT_OPERATION_PENDING_RECONCILIATION` — awaits webhook |
| `conflict`/`invalid` (defensive) | no | 500 `OPERATION_LOCK_UNEXPECTED` |

Provider ambiguity (502) now persists the unknown result under **both** the
client Idempotency-Key **and** the op-lock, so any fresh-key retry hits the
op-lock replay path and never blindly re-invokes the provider.

## 4. Security properties

- Scope excludes `Idempotency-Key`, request ID, IP, tokens, and every
  body-supplied tenant/institution/merchant field.
- Scope excludes `beneficiary_name` (already forbidden as a client override).
- `user_id` sourced from JWT claims (`auth.getClaims`); different tenants /
  users produce different op-keys → isolated slots.
- No provider secret, stack trace, or authorization header is logged or
  echoed on any branch.
- The op-lock lives in `integration_idempotency_keys`, which already has RLS
  scoped to service-role writes only (per Phase 5a).

## 5. Files touched

- `supabase/functions/_shared/integration-layer/operation-lock.ts` (new)
- `supabase/functions/nium-create-global-account/index.ts`
  - Import op-lock helper.
  - Reserve op-lock after client-key check, BEFORE provider call.
  - Handle `in_flight`, `replay`+recovered, `replay`+pending branches.
  - Persist ambiguity under op-lock in the catch block.
  - Persist success under op-lock after local insert.
- `src/test/create-global-account-cross-key-b1x.test.ts` (new, 19 tests)

## 6. Test evidence

| Suite | Result |
| --- | --- |
| `create-global-account-cross-key-b1x` (b.1X) | 19/19 PASS |
| `create-global-account-idempotency-wiring` (b.1) | 14/14 PASS |
| `create-global-account-ambiguity-b1v` (b.1V) | 13/13 PASS |
| `nium-webhook-contract-reconciliation` (a.3C) | 15/15 PASS |
| `openapi-quality-gates` harness | 74/74 PASS |

## 7. Gate baseline

Unchanged: **187 total** (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79).
API version 4.53.1, 484 operations. Touched-file lint: 0 errors.

## 8. Concurrency guarantee

The op-lock is enforced by a Postgres UNIQUE-on-INSERT against
`integration_idempotency_keys(merchant_id, idempotency_key)`. Concurrent
fresh-key requests for the same scope race on the same op-key row; exactly
one INSERT succeeds. The provider create can therefore run at most **once**
per scope until the reservation completes or expires (60s in-flight TTL,
then reclaimable — but only after any success or ambiguity has been persisted
under the op-lock).

## 9. Rollback

1. Revert `supabase/functions/nium-create-global-account/index.ts` to commit
   preceding b.1X (removes op-lock reservation, defensive branches, and the
   dual-store in success/ambiguity paths).
2. Delete `supabase/functions/_shared/integration-layer/operation-lock.ts`.
3. Delete `src/test/create-global-account-cross-key-b1x.test.ts`.
4. No database rollback required — no schema change was made. Any op-lock
   rows already written to `integration_idempotency_keys` will expire
   naturally (24 h TTL) and are harmless (namespaced under `op:` resource).

## 10. Not authorised in this phase

- Production deployment
- OpenAPI change / version increment / SDK publication
- Any migration
- Beginning Phase 1B-R1I-b.2

---

**PHASE 1B-R1I-b.1 PASS — ELIGIBLE FOR b.2 REVIEW**
