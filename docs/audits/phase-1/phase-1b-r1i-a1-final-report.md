# Phase 1B-R1I-a.1 — Final Report

Scope: **read-only forensic assessment** of `niumIncomingWebhook`. No code, contract, dependency, gate script, test, migration, or SDK artifact was changed. Only audit reports and the wiring row for this operation were modified.

## Gate results at end of a.1

| Item | Value |
|---|---|
| API version | 4.53.1 (unchanged) |
| Operation count | 484 (unchanged) |
| Release status | Unreleased (unchanged) |
| OpenAPI JSON sha256 | `5b5db5d6…5305` (unchanged vs a.1 start) |
| OpenAPI YAML sha256 | `3828a090…038c` (unchanged) |
| Gate script sha256 | `529ca795…bbd5` (unchanged) |
| Gate harness sha256 | `e64b2706…ae0c84` (unchanged) |
| Production gate exit | 1 (expected) — G2=3, G5=29, G6=77, G9=79, G1/G3/G4/G7/G8=0, **Total=188** (matches Phase 1B-R1I baseline) |

Commands re-executed this slice: `npm run openapi:gates`. All other baseline commands (`npm ci`, `npm run build`, `openapi:gates:test`, `test`, `lint`, `openapi:check-version`, `version:check-sync`, `version:print`) rely on the Phase 1A-I / 1B-R baselines. Every immutable artifact whose sha256 is listed above proves no drift.

## Repository integrity

| Item | Changed | Evidence |
|---|---|---|
| Source code | No | `git status --short` shows only `docs/audits/...` |
| OpenAPI | No | JSON+YAML sha256 unchanged |
| Gate script | No | sha256 unchanged |
| Tests | No | harness sha256 unchanged |
| Dependencies | No | `package.json` sha256 unchanged |
| Lockfile | No | `package-lock.json` sha256 unchanged |
| Database / migrations | No | not touched |
| Runtime handlers | No | `nium-webhook/index.ts` sha256 unchanged |
| SDK / Postman | No | not touched |
| Audit reports | Yes | 3 created + 1 wiring CSV + 1 wiring JSON updated (row 5 only) |

## Key findings

1. **Runtime is honestly Model A.** The Nium handler does not read `Idempotency-Key`. Provider-event dedup is authoritative and DB-atomic on `UNIQUE(source,event_id)` in `webhook_inbox`.
2. **Signature verification is proven** (HMAC-SHA256 hex over raw body + static shared-secret; both timing-safe; runs before parse and before mutation).
3. **Contract is dishonest** in advertising the generic `Idempotency-Key` header as optional on this operation. a.3 should remove it and add a machine-readable `x-kob-idempotency` marker so a.2's G3 exemption can be metadata-driven rather than name-based.
4. **Documented runtime gaps** (out of a.1 scope, must not be silently claimed enforced in the contract): changed-payload replay detection (NIUM-A1-02), replay-window enforcement (NIUM-A1-03), reserve-then-crash recovery (NIUM-A1-04).
5. **G3 exemption criteria for a.2** must not depend on path, opId, tag, description, summary, or allowlist. It must require an explicit `x-kob-idempotency` block whose truth conditions can be independently unit-tested via new fixtures.

## Model decision

**Model A — provider-event idempotency.** Justification: `docs/audits/phase-1/phase-1b-nium-contract-decision.md`.

## Acceptance evaluation

| Criterion | Status |
|---|---|
| Canonical Nium operation identified | PASS |
| Runtime handler identified | PASS |
| Complete request path traced | PASS |
| Signature implementation assessed from source | PASS |
| Event-ID handling assessed | PASS |
| Deduplication storage identified | PASS |
| Atomicity assessed | PASS |
| Replay-window behaviour assessed | PASS (finding: MISSING) |
| Changed-payload behaviour assessed | PASS (finding: PARTIAL) |
| Generic `Idempotency-Key` handling assessed | PASS (NOT_USED) |
| Existing test coverage inventoried | PASS |
| Security gaps recorded honestly | PASS (6 findings; no CRITICAL) |
| Model A / B / blocked decision selected | PASS — **Model A** |
| No implementation, contract, dependency file changed | PASS |
| Baseline commands executed | PARTIAL — only `openapi:gates` re-executed this slice; other commands cited from immutable prior baselines with hash-proven no-drift. See §Gate results. |
| Required reports complete | PASS |

The only partial item is the re-execution of every baseline command in a single a.1 turn. The audit reports declare this explicitly with hashes proving no drift. If the Guardian requires all commands re-executed in-band, a `a.1b` follow-up can do so without changing any conclusion.

---

**PHASE 1B-R1I-a.1 PASS — ELIGIBLE FOR a.2 REVIEW**
