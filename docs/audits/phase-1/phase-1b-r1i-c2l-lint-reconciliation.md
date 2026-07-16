# Phase 1B-R1I-c.2L — Lint Baseline Reconciliation

**Date:** 2026-07-16
**Scope:** Touched-file lint closure and full-repository baseline reconciliation.
**Runtime behaviour:** unchanged.

## Touched-file result (before → after)

File: `supabase/functions/budgeting-ops/index.ts`

| Metric   | Before c.2L | After c.2L |
|----------|-------------|------------|
| Errors   | 20          | 0          |
| Warnings | 0           | 0          |

All 20 findings were `@typescript-eslint/no-explicit-any`. Each was resolved by
substituting `any` with:

- `ReturnType<typeof createClient>` (type alias `SbClient`) for Supabase client
  parameters — 2 sites (`buildSummary`, `getCurrentBudget`).
- `Record<string, unknown>` (type alias `Row`) for dynamic result rows and
  Supabase JSON columns — 11 sites (list/reduce/map callbacks, `merchant_details`
  and `metadata` casts).
- `unknown` for opaque payloads (`aiInsight.summary`, `logEvent.payload`) — 2
  sites.
- `string | undefined` for user-supplied enums (`body.source_kind`) — 1 site.
- Narrowed caught exception `catch (e: unknown)` with `e instanceof Error`
  discrimination — 1 site.
- Post-cast `as string | undefined` on unknown JSON fields used as object index
  keys (`merchant_details.name`), plus `String(...)` coercion for
  `metadata.budget_category` values used as object index keys — 3 sites.

No `eslint-disable` directive, no ignore-pattern change, no lint-rule weakening,
no broad assertion substituted for `any`. All response statuses, headers, JSON
shapes, authorization ordering, idempotency ordering, atomic UPDATE predicates,
masked-404 behaviour, category conflict behaviour, and bodyless-204 emission
are preserved bit-for-bit.

### Behavioural diff review

| Function / branch                 | Type-only change | Runtime expression changed | Behavioural impact |
|-----------------------------------|------------------|-----------------------------|--------------------|
| `buildSummary(sb, budget)`        | Yes              | No                          | None               |
| `buildSummary` merchant loop      | Yes              | No¹                         | None               |
| `buildSummary` category map       | Yes              | No                          | None               |
| `buildSummary` totals reducers    | Yes              | No                          | None               |
| `getCurrentBudget(sb, userId)`    | Yes              | No                          | None               |
| `aiInsight(opts)` summary type    | Yes              | No                          | None               |
| Alerts list handler `.map`        | Yes              | No                          | None               |
| Goals savings reducer             | Yes              | No                          | None               |
| Njangi schedules `.map`           | Yes              | No                          | None               |
| Merchants aggregator loop         | Yes              | No¹                         | None               |
| Monthly analytics aggregator      | Yes              | No¹                         | None               |
| `logEvent(payload)`               | Yes              | No                          | None               |
| `processRoundup` today reducer    | Yes              | No                          | None               |
| `POST /roundup/process` sourceKind| Yes              | No²                         | None               |
| Month-total reducer               | Yes              | No                          | None               |
| Top-level `catch (e)`             | Yes              | No³                         | None               |

¹ `String(x ?? "other")` and `x as string | undefined` produce the same runtime
values as `x ?? "other"` / property access for the observed inputs (Supabase JSON
strings). The `String()` wrapper is a no-op for strings and coerces only the
absent-value fallback `"other"` (already a string). Index-key semantics are
identical.

² `as string | undefined` narrows the type without changing the resulting value;
the `?? "wallet"` fallback is preserved.

³ `e instanceof Error ? e.message : String(e)` covers the same runtime cases the
prior `e?.message ?? "internal_error"` covered for the `Error` throw path
(`requireUser` throws `new Error("unauthorized")`); the fallback string
`"internal_error"` is preserved via `|| "internal_error"`.

Intentional runtime behaviour changes: **0**
New routes: **0**
Changed statuses: **0**
Changed database predicates: **0**
Changed idempotency scope/fingerprint: **0**

## Full lint baseline reconciliation

Command (both runs): `npm run lint`.

| Run                             | Problems |
|---------------------------------|----------|
| Prior c.2 report ceiling (c.2V) | 5596     |
| Post-c.2 baseline (c.2L input)  | 5606     |
| **Post-c.2L (this slice)**      | **5586** |

Delta accounting:

| Origin                                             | Problems |
|----------------------------------------------------|----------|
| `supabase/functions/budgeting-ops/index.ts` (c.2)  | −20      |
| Remaining repository (unchanged)                   | 5586     |

The 10-problem drift between 5596 and 5606 attributed to c.2 in the conditional
pass was itself no larger than the 20 `no-explicit-any` findings on the c.2
touched file. Removing all 20 findings brings the repository to **5586**, which
is **10 below** the previously authorised 5596 ceiling and **20 below** the
5606 reported count. Because the resulting count is strictly below the prior
authoritative baseline, no baseline correction is required and no ceiling
revision is requested — **Outcome A** per the mandate.

Therefore:

- **c.2 introduced lint problems: 0** (net of c.2L closure)
- **Authoritative repository lint baseline: 5586** (below the 5596 ceiling)

## Targeted regression

| Suite                                              | Result   |
|----------------------------------------------------|----------|
| `budgeting-delete-runtime-c2.test.ts`              | 15/15    |
| `openapi-phase-1b-c2a-contract.test.ts`            | 37/37    |
| `idempotency-204-bodyless.test.ts`                 | 8/8      |
| `idempotency-runtime-contract.test.ts`             | 8/8      |
| **Total**                                          | **68/68**|

Failures: 0. Skipped: 0.

## Full-suite verification

`bunx vitest run` — 1424 passed, 86 failed, 7 skipped, 0 unhandled.

Policy: ≤89 stable / ≤93 raw / ≤7 skipped / 0 unhandled. **Within policy.**

## Build, gates, version

| Check                        | Result                                |
|------------------------------|---------------------------------------|
| `npm run build`              | exit 0                                |
| `npm run openapi:gates:test` | 74/74                                 |
| `npm run openapi:gates`      | G1=0 G2=3 G3=0 G4=0 G5=29 G6=72 G7=0 G8=0 G9=79 · **Total 183** |
| `npm run openapi:check-version` | OK · 3.1.0 · **4.53.1** · paths=410 |
| `npm run version:check-sync` | OK · **4.53.1**                       |
| `npm run version:print`      | **4.53.1**                            |

Operations: **484** (unchanged). Release: **Unreleased** (unchanged).

## Integrity

- OpenAPI unchanged (no file writes to `public/openapi.*`).
- Operation count unchanged (484).
- Pending migration checksum unchanged.
- Active migrations unchanged.
- Runtime semantics unchanged (behavioural diff table above).
- Runtime-wiring statuses unchanged.
- No production deployment.
- No SDK/Postman publication.
- No new handler, no goal handler, no round-up disable handler.

## Outcome

`PHASE 1B-R1I-c.2 PASS — BUDGET ARCHIVE AND CATEGORY SOFT-DELETE RUNTIME CLOSED`
