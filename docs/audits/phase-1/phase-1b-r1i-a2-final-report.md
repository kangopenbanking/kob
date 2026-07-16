# PHASE 1B-R1I-a.2 — Provider-Event G3 Gate Semantics and Fixtures

**Status:** PASS — ELIGIBLE FOR a.3 REVIEW
**API version:** 4.53.1 (unchanged)
**Operation count:** 484 (unchanged)
**Production gate failures:** 188 (unchanged)

## 1. Baseline (Before)

| Item                            | Value                                                                 |
|---------------------------------|-----------------------------------------------------------------------|
| Branch                          | (current working branch)                                              |
| Commit SHA (pre-a.2)            | fe46fcc6b6c21728d5400a71b581b6e80e903bad                              |
| Node / npm                      | v22.22.0 / 10.9.4                                                     |
| package.json SHA-256            | 490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3      |
| package-lock.json SHA-256       | 137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5      |
| public/openapi.json SHA-256     | 5b5db5d6b67829c130aa8f7e0883dd666ebf69eb60b7d7cab574909f0f0e5305      |
| public/openapi.yaml SHA-256     | 3828a0904ff7a3b6c1c5e6e48a1bff525755d8eea5abc64bbd6ee12b6bbe038c      |
| scripts/openapi-quality-gates.mjs (pre) | 529ca795459f11aebb13b8b2407694609c92d3e3d6dc0ddde0ebdfa9c15cbbd5 |
| src/test/openapi-quality-gates.test.ts (pre) | e64b27065dc0190e5fdc0a853ba5ea48c7812ac91776df69c44921e947ae0c84 |
| API version                     | 4.53.1                                                                |
| Operation count                 | 484                                                                   |
| Gate totals                     | G1=0 G2=3 G3=0 G4=0 G5=29 G6=77 G7=0 G8=0 G9=79 · total=188           |
| Gate-harness tests              | 35 pass / 0 fail                                                      |

## 2. Extension Schema

### Operation-level `x-kob-idempotency`

| Field                             | Type    | Required | Value           |
|-----------------------------------|---------|----------|-----------------|
| `mode`                            | string  | yes      | `provider-event`|
| `provider`                        | string  | yes      | non-empty       |
| `event-id-required`               | boolean | yes      | must be `true`  |
| `signature-required`              | boolean | yes      | must be `true`  |
| `atomic-deduplication-required`   | boolean | yes      | must be `true`  |
| `replay-window-enforced`          | boolean | yes      | must be `true`  |
| `payload-consistency-enforced`    | boolean | yes      | must be `true`  |
| `failure-recovery-enforced`       | boolean | yes      | must be `true`  |

### Operation-level `x-kob-webhook`

| Field                | Type    | Required | Semantics                                              |
|----------------------|---------|----------|--------------------------------------------------------|
| `receiver`           | boolean | yes      | exactly `true`                                         |
| `provider`           | string  | yes      | must equal `x-kob-idempotency.provider`                |
| `signature-header`   | string  | yes      | must match a **required** OpenAPI header parameter     |
| `event-id-location`  | enum    | yes      | `body` or `header`                                     |
| `event-id-pointer`   | string  | yes      | JSON pointer resolvable to a required body property, or a required header name |

## 3. Qualifying Rules (Anti-Gaming)

An operation qualifies for provider-event G3 exemption **only** when **all** of the following are true:

1. HTTP method is `POST`.
2. `x-kob-idempotency` is an object with `mode = provider-event` and all six control booleans strictly `=== true`.
3. `provider` is a non-empty string in both extension blocks and they match.
4. `x-kob-webhook.receiver === true`.
5. `signature-header` resolves to a header parameter with `required: true`.
6. Event-ID pointer resolves against the request schema (or required header) and the leaf is present in `required[]`.

Non-qualifying signals — all explicitly ignored:

- `"webhook"` in `path`, `operationId`, `tag`, `summary`, `description`, request-schema name, handler name, or `provider` value.
- Free-text description claims of provider dedupe without structured metadata.
- Copying the extension onto an ordinary client-created mutation.
- Any misspelled extension key (e.g. `x-kob-idempotencyy`) — treated as absent → generic G3 failure.

## 4. Fixture Inventory

### Positive (1)
| Fixture                                  | Expected G3 | Actual G3 | Exit | Status |
|------------------------------------------|-------------|-----------|------|--------|
| Fully compliant provider-event webhook   | 0           | 0         | 0    | PASS   |

### Negative — naming-only bypass (5)
| Fixture                       | Expected G3 | Actual G3 | Status |
|-------------------------------|-------------|-----------|--------|
| `/webhook` in path only       | 1           | 1         | PASS   |
| `Webhook` in operationId only | 1           | 1         | PASS   |
| `Webhook` in tag only         | 1           | 1         | PASS   |
| `webhook` in summary only     | 1           | 1         | PASS   |
| Description dedupe claim only | 1           | 1         | PASS   |

### Negative — incomplete extension (12)
Missing provider · empty provider · missing `event-id-required` · `event-id-required=false` · missing `signature-required` · `signature-required=false` · missing `atomic-deduplication-required` · missing `replay-window-enforced` · missing `payload-consistency-enforced` · missing `failure-recovery-enforced` · invalid mode · boolean as string. **All → G3=1 with named reason.**

### Negative — contract/runtime evidence (7)
Missing sig header · sig header optional · pointer does not resolve · event-id field optional · webhook marker absent · provider mismatch · ordinary mutation copies extension. **All → G3=1 with named reason.**

### Malformed extension safety (4 + continuation proof)
`x-kob-idempotency` as string / array / null / number → fails safely, G3=1, no `UnhandledPromiseRejection`. A separate case proves later operations continue to be evaluated after malformed metadata.

### Cross-gate integrity (4)
| Scenario                                             | Expected     | Actual        | Status |
|------------------------------------------------------|--------------|---------------|--------|
| Provider-event webhook + broken G5                   | G3=0, G5≥1   | G3=0, G5=1    | PASS   |
| Provider-event webhook + missing 409                 | G3=0, G6≥1   | G3=0, G6=1    | PASS   |
| Provider-event webhook without X-Request-ID          | G3=0, G9≥1   | G3=0, G9=1    | PASS   |
| Provider-event webhook + 200 missing schema (G1)     | G3=0, G1≥1   | G3=0, G1=1    | PASS   |

### Preserved ordinary G3 behaviour (2)
Ordinary financial mutation without `Idempotency-Key` still fails G3. Ordinary financial mutation with canonical header still passes G3.

## 5. Gate Output Quality

Failures caused by an incomplete exemption are prefixed with:

```
G3 provider-event exemption invalid: <reason>
```

Where `<reason>` is one of a fixed vocabulary (e.g. `replay-window-enforced must be true`, `required signature header "X-Nium-Signature" not found`, `event ID pointer does not resolve`). Failures caused by a missing extension retain the legacy diagnostic `financial mutation missing Idempotency-Key header`.

## 6. Test Totals

| Metric               | Before | After | Diff |
|----------------------|--------|-------|------|
| Gate-harness tests   | 35     | 74    | +39  |
| Gate-harness passing | 35     | 74    | +39  |
| Gate-harness failing | 0      | 0     | 0    |
| Gate-harness skipped | 0      | 0     | 0    |

## 7. Production Contract Immutability

| Item                                | Before                                                            | After                                                             | Changed |
|-------------------------------------|-------------------------------------------------------------------|-------------------------------------------------------------------|---------|
| API version                         | 4.53.1                                                            | 4.53.1                                                            | No      |
| Operation count                     | 484                                                               | 484                                                               | No      |
| Production `byGate`                 | G1=0 G2=3 G3=0 G4=0 G5=29 G6=77 G7=0 G8=0 G9=79                    | G1=0 G2=3 G3=0 G4=0 G5=29 G6=77 G7=0 G8=0 G9=79                    | No      |
| Production total failures           | 188                                                               | 188                                                               | No      |
| `public/openapi.json` SHA-256       | 5b5db5d6b67829c130aa8f7e0883dd666ebf69eb60b7d7cab574909f0f0e5305  | 5b5db5d6b67829c130aa8f7e0883dd666ebf69eb60b7d7cab574909f0f0e5305  | No      |
| `public/openapi.yaml` SHA-256       | 3828a0904ff7a3b6c1c5e6e48a1bff525755d8eea5abc64bbd6ee12b6bbe038c  | 3828a0904ff7a3b6c1c5e6e48a1bff525755d8eea5abc64bbd6ee12b6bbe038c  | No      |
| `package.json` SHA-256              | 490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3  | 490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3  | No      |
| `package-lock.json` SHA-256         | 137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5  | 137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5  | No      |
| Nium generic `Idempotency-Key`      | Present                                                           | Present                                                           | No      |
| Nium provider-event marker          | Absent                                                            | Absent                                                            | No      |
| SDK / Postman / changelog artifacts | Untouched                                                         | Untouched                                                         | No      |

## 8. Remaining a.3 Runtime Gaps

The production Nium operation must **not** be migrated to the provider-event exemption until a.3 closes:

1. **Changed-payload fingerprint protection** — SHA-256 of raw body persisted alongside `webhook_inbox.event_id`, verified on re-delivery.
2. **Explicit replay-window enforcement** — timestamp skew rejection (documented tolerance ≤ 5 min).
3. **Reserve-then-crash recovery** — atomic reservation row created before downstream ledger writes, with resumable finish path on restart.

Only once all three are implemented, unit-tested and captured in the Nium contract-decision report may the production operation add `x-kob-idempotency` + `x-kob-webhook` and remove the temporary generic `Idempotency-Key` parameter.

## 9. Rollback Instructions

Full rollback is a single-file revert of two source files and three doc updates — no schema, deployment or lockfile impact:

```bash
git checkout HEAD -- \
  scripts/openapi-quality-gates.mjs \
  src/test/openapi-quality-gates.test.ts \
  docs/audits/phase-1/quality-gate-integrity-report.md \
  docs/audits/phase-1/phase-1b-nium-contract-decision.md \
  docs/audits/phase-1/phase-1b-r1i-a2-final-report.md
```

After revert:

```bash
npm run openapi:gates       # expect 188 failures
npx vitest run src/test/openapi-quality-gates.test.ts   # expect 35 tests pass
```

## 10. a.2 Acceptance Checklist

- [x] G3 supports a complete provider-event model.
- [x] Every provider-event control is mandatory (`=== true`).
- [x] Missing or false controls fail G3 with named reasons.
- [x] Naming-only webhook attempts fail G3.
- [x] Ordinary financial mutations remain protected.
- [x] A fake client mutation cannot copy the extension to bypass G3.
- [x] Required signature header and event ID are structurally verified.
- [x] Cross-gate integrity preserved (exemption suppresses G3 only).
- [x] All existing and new gate tests pass (74/74).
- [x] Gate script fails safely on malformed metadata (try/catch around per-op sweep).
- [x] Production OpenAPI unchanged (SHA-256 match).
- [x] Nium production marker not added.
- [x] Nium generic `Idempotency-Key` header not removed.
- [x] Production gate totals remain exactly 188.
- [x] API version remains 4.53.1.
- [x] Operation count remains 484.
- [x] No dependency or lockfile change.
- [x] Documentation and rollback instructions complete.

---

## Addendum — a.2V lint closure

Touched-file lint (`scripts/openapi-quality-gates.mjs`,
`src/test/openapi-quality-gates.test.ts`) now exits 0. Root cause and
surgical corrections are documented in
`docs/audits/phase-1/phase-1b-r1i-a2v-final-report.md`. Production
OpenAPI files, Nium handler, database, dependencies and SDK/Postman
artifacts remain unchanged. Rollback:
`git checkout HEAD -- src/test/openapi-quality-gates.test.ts`.
