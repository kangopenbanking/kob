# Phase 1B-R1I-a.3C — Nium Contract Reconciliation (Closeout)

**Authorization:** APPROVED
**Scope:** OpenAPI contract only — align `niumIncomingWebhook` with the a.3 runtime hardening.
**Version:** 4.53.1 (unchanged — Standing Order #6: additive, no operation added/removed)
**Operations:** 484 (unchanged — Standing Order #1: Lock)

## 1. Contract changes (surgical, additive)

Path: `POST /v1/gateway/global-accounts/webhook` · operationId `niumIncomingWebhook`.

| Change | Type | Justification |
|---|---|---|
| Generic `Idempotency-Key` header parameter removed from this operation | Removal (scoped, non-breaking for provider-sent events) | Provider-event webhooks derive idempotency from `transactionId`, not a client header. Standing Order #4 (Surgeon Rule) satisfied: `IdempotencyKeyHeader` component preserved for other operations. |
| `x-nium-timestamp` optional header added | Additive | Documents the ±300s replay-window semantics enforced at runtime. |
| `x-kob-idempotency` metadata added with `mode=provider-event`, `provider=nium`, and all seven controls set `true` | Additive extension | Aligns with a.2 gate semantics. |
| `x-kob-webhook` metadata added: `receiver=true`, `provider=nium`, `signature-header=x-nium-signature`, `event-id-location=body`, `event-id-pointer=/transactionId` | Additive extension | Points to the required `transactionId` field in the request-body schema. |
| `409 Conflict` response added, referencing Problem Details (`application/problem+json`) | Additive | Documents the changed-payload rejection path proven in a.3 runtime. |
| Description expanded to document replay window, duplicate acknowledgement, changed-payload 409, no client Idempotency-Key expected | Documentation | Standing Order P6 (Complete Content). |

Method / path / operationId / tags / security / request schema `required[]` — all unchanged.

## 2. Gate deltas (production spec)

| Metric | Pre-a.3C | Post-a.3C | Δ |
|---|---|---|---|
| Total failures | 188 | 187 | −1 |
| G1 schemas | 0 | 0 | 0 |
| G2 webhooks | 3 | 3 | 0 |
| G3 idempotency | 0 | 0 | 0 |
| G4 pagination | 0 | 0 | 0 |
| G5 RFC 7807 | 29 | 29 | 0 |
| G6 descriptions | 77 | 76 | −1 |
| G7 DELETE idempotency | 0 | 0 | 0 |
| G8 …  | 0 | 0 | 0 |
| G9 …  | 79 | 79 | 0 |

Standing Order #2 (Ratchet) honoured: every gate stayed flat or improved.

## 3. Verification

| Check | Result |
|---|---|
| `check-openapi-version` | OK · 4.53.1 · paths=410 |
| `check-version-sync` | OK · 4.53.1 |
| `npm run build` | PASS (Rollup 4.44.2 pin unchanged) |
| Targeted tests (6 files, 129 tests) | 129/129 PASS |
| — `openapi-quality-gates.test.ts` (74) | PASS (post-a.3C baseline 187 asserted) |
| — `nium-webhook-contract-reconciliation.test.ts` (15, new) | PASS |
| — `openapi-phase-1b-contract.test.ts` (19, adjusted) | PASS |
| — `nium-webhook-hardening.test.ts` (8) | PASS |
| — `webhook-replay-e2e.test.ts` (8) | PASS |
| — `webhook-signature-runtime-contract.test.ts` (5) | PASS |
| Full suite ratchet (fail ≤ 90, pass ≥ 1250, skip ≤ 7) | HOLDS (89 / 1273 / 7) |
| Lint (touched files) | 0 errors, 0 warnings |

## 4. Artefact hashes

| File | sha256 |
|---|---|
| `public/openapi.json` | `9f428382e191f880a73aa1277adbd558a57dcedafbb0cd8c91c8b5017ddd915e` |
| `public/openapi.yaml` | `51d5206eeee590fb069c775802a47e831ec11000292a41ce3f5271b9fca399fb` |
| `scripts/patch-openapi-nium-webhook-contract.mjs` | `bce90a56aa588ca7b882145b1d1d877d23da2c967b6e34490a4788ddf90ed64f` |
| `src/test/nium-webhook-contract-reconciliation.test.ts` | `5a49b42b385104acaab6b8170c66ea255bf4c3945bb8a774bd971a71127bb8e9` |

## 5. Rollback

1. `git checkout -- public/openapi.json public/openapi.yaml src/test/openapi-quality-gates.test.ts src/test/openapi-phase-1b-contract.test.ts`
2. `rm src/test/nium-webhook-contract-reconciliation.test.ts scripts/patch-openapi-nium-webhook-contract.mjs`
3. No DB migration; no runtime change; no rollback SQL required.

## 6. Verdict

**PHASE 1B-R1I-a.3C PASS — CONTRACT RECONCILED**

Spec now matches the a.3 runtime exactly. `niumIncomingWebhook` no longer advertises a generic `Idempotency-Key` and formally documents provider-event idempotency, replay-window semantics, and the 409 Conflict path. Version 4.53.1 preserved; operation count 484 preserved; gate score improved by one; ratchet holds.
