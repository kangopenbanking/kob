# Phase 1B-R1I-a.3V — Nium Runtime Verification (Final Report)

**Authorization:** CONDITIONALLY AUTHORIZED — LOCAL/TEST ONLY
**Authorizing role:** Chief Architect and Phase Guardian
**Co-reviewers:** Security Officer, API Product Owner
**Scope executed:** Verification only. No contract change. No production action.

## 1. Baseline

| Item | Value |
|---|---|
| Node / npm | v22.22.0 / 10.9.4 |
| API version (SSOT + spec) | 4.53.1 |
| Operation count | 484 |
| `package.json` sha256 | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` |
| `package-lock.json` sha256 (before AND after clean install) | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| `public/openapi.json` sha256 | `5b5db5d6b67829c130aa8f7e0883dd666ebf69eb60b7d7cab574909f0f0e5305` |
| `public/openapi.yaml` sha256 | `3828a0904ff7a3b6c1c5e6e48a1bff525755d8eea5abc64bbd6ee12b6bbe038c` |
| `supabase/functions/nium-webhook/index.ts` sha256 | `d9ea3d1a1cb360bc9a4c3e11c3f2f60fe90110bf320d59b5fa5f5b23716329b3` |
| `_shared/webhook-replay-protection.ts` sha256 | `760cd88a3cd56cb86fe43a110e36bb19fc2d04eb79ed2f238d9c1902789e7fd5` |

## 2. Clean reproducibility

- `rm -rf node_modules && npm ci` → exit 0 (1365 packages).
- `npm run build` → exit 0. Rollup pin (4.44.2) unchanged; Vite unchanged; lockfile hash unchanged post-install.

## 3. Targeted tests (104 / 104)

| Suite | Tests | Result |
|---|---|---|
| `src/test/openapi-quality-gates.test.ts` | 74 | PASS |
| `src/test/nium-webhook-hardening.test.ts` | 8 | PASS |
| `src/test/webhook-replay-protection.test.ts` | 9 | PASS |
| `src/test/webhook-replay-e2e.test.ts` | 8 | PASS |
| `src/test/webhook-signature-runtime-contract.test.ts` | 5 | PASS |

Coverage confirms: signature verify → timestamp validate → reserve → mutate → ack ordering; fingerprint SHA-256 determinism; same-payload duplicate acknowledged with single mutation; changed-payload → HTTP 409 without leaking payload/fingerprint; ±300 s replay window boundaries; stale (>90 s) unprocessed reclaim; concurrent-race collapses to a single accepted row via `UNIQUE(source, event_id)`.

## 4. Production OpenAPI gates (unchanged baseline)

```
totalOperations: 484
failures: 188
  G1: 0    G2: 3    G3: 0    G4: 0
  G5: 29   G6: 77   G7: 0    G8: 0    G9: 79
```

Matches the authorized a.3V baseline exactly.

## 5. Full test suite (ratchet holds)

- Tests: **86 failed**, **1262 passed**, **7 skipped**, **0 unhandled** across 123 files.
- Ratchet ceilings: fail ≤ 90 ✓, pass ≥ 1250 ✓, skip ≤ 7 ✓, unhandled = 0 ✓.
- No new regression introduced by a.3.

## 6. Lint

- Touched files (`nium-webhook/index.ts`, `_shared/webhook-replay-protection.ts`, `src/test/nium-webhook-hardening.test.ts`) — **0 errors, 0 warnings** after replacing a stray `any` with `Record<string, unknown>` on the parsed payload local. No `eslint-disable` added.

## 7. Version & contract immutability

- `check-openapi-version` → OK · 4.53.1
- `check-version-sync` → OK · 4.53.1
- `print-expected-version` → 4.53.1
- OpenAPI JSON/YAML sha256 unchanged vs a.3 closeout.
- `niumIncomingWebhook` still carries the generic `Idempotency-Key` parameter; provider-event `x-kob-idempotency` marker still absent. **Contract untouched, as required.**

## 8. Rollback

1. `git checkout -- supabase/functions/nium-webhook/index.ts supabase/functions/_shared/webhook-replay-protection.ts`
2. Remove `supabase/functions/_shared/webhook-replay-protection_test.ts` and `src/test/nium-webhook-hardening.test.ts`.
3. `rm -rf node_modules && npm ci` (lockfile unchanged, restore is a no-op).
4. No DB migration was executed; no rollback SQL required.

## 9. Verdict

**PHASE 1B-R1I-a.3V PASS — CONTRACT RECONCILIATION AUTHORIZED**

All acceptance criteria met: clean install & build, 104/104 targeted, gate baseline held at 188, full suite within ratchet, touched-file lint clean, OpenAPI hashes unchanged, version 4.53.1 Unreleased, operation count 484, no production action performed.
