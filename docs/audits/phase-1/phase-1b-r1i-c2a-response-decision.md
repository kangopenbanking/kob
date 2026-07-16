# Phase 1B-R1I-c.2A — Budgeting DELETE Response Decision Record

**Status:** RATIFIED. Contract corrected in `public/openapi.json` (+ regenerated `public/openapi.yaml`). No runtime code, migrations, SDK or Postman artifacts changed.

**Predecessor gate:** `PHASE 1B-R1I-c.2 BLOCKED — CONTRACT RESPONSE DECISION REQUIRED` (see `phase-1b-r1i-c2-contract-block.md`).

**Contract state:**

| Control | Expected | Actual |
| --- | --- | --- |
| API version | 4.53.1 | 4.53.1 |
| Release status | Unreleased | Unreleased |
| Operation count | 484 | 484 |
| Rollup | 4.44.2 | 4.44.2 |
| Runtime handlers | Unchanged | Unchanged |
| Database artifacts | Unchanged | Unchanged |
| SDK / Postman publication | None | None |
| Deployment | None | None |

## 1. Operations corrected

| Operation ID | Method | Path |
| --- | --- | --- |
| `budgetingDeleteBudget` | DELETE | `/v1/budgeting/budgets/{budgetId}` |
| `budgetingDeleteCategory` | DELETE | `/v1/budgeting/categories/{categoryId}` |

Both operations already documented an optional `Idempotency-Key` header via `#/components/parameters/IdempotencyKeyHeader`. That header remained unchanged (optional, UUID v4, `required: false`, `maxLength: 255`, description covers reuse/in-flight behaviour).

## 2. Response contract (A)

| Operation | 204 | 400 | 401 | 403 | 404 | 409 | 500 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `budgetingDeleteBudget` | ✔ | ✔ | ✔ | — | ✔ (masked) | ✔ | ✔ |
| `budgetingDeleteCategory` | ✔ | ✔ | ✔ | — | ✔ (masked) | ✔ | ✔ |

Both operations additionally declare `429 Too Many Requests` (`#/components/responses/TooManyRequests`) to remain consistent with every other state-mutating operation in the spec and to satisfy Gate G6 without any weakening.

### 403 decision (Section 3 of the mandate)

**Decision: 403 omitted.**

Rationale: Both operations act exclusively on user-owned budgets and categories. There is no established KOB case in which the resource is legitimately visible to the authenticated actor yet the actor lacks a delegated or administrative permission to perform the DELETE. Cross-owner and cross-tenant access must be concealed under the masked `404` per Section 2.4 of the mandate. Adding `403` would either duplicate `404` semantics or imply a permission model that does not exist for these resources, which would violate the truthfulness requirement and Standing Order #5 (Dead Code Rule).

## 3. Error semantics (B)

| Scenario | Status | Problem code | Leakage-safe | Status |
| --- | --- | --- | --- | --- |
| Missing / invalid / expired authentication | 401 | (per `Unauthorized`) | Yes — no user data | Documented |
| Malformed budget/category ID | 400 | `INVALID_RESOURCE_ID` | Yes | Documented |
| Malformed `Idempotency-Key` (not UUID v4) | 400 | `INVALID_IDEMPOTENCY_KEY` | Yes | Documented |
| Nonexistent resource | 404 | (per `NotFound`) | Yes | Documented |
| Cross-tenant / cross-owner resource | 404 | (per `NotFound`) | Yes — masked | Documented (op.description) |
| Protected system category | 409 | `SYSTEM_CATEGORY_PROTECTED` | Yes | Documented (category only) |
| Active dependency prevents soft-delete | 409 | `CATEGORY_HAS_ACTIVE_DEPENDENCIES` | Yes | Documented (category only) |
| Idempotency key reused with different body | 409 | `IDEMPOTENCY_KEY_REUSED` | Yes | Documented |
| Concurrent same-key in-flight request | 409 | `IDEMPOTENCY_REQUEST_IN_PROGRESS` | Yes | Documented |
| Terminal-state replay (already archived / soft-deleted) | 204 | — | Yes — no repeated side effect | Documented (op.description) |
| Rate-limited | 429 | (per `TooManyRequests`) | Yes | Documented |
| Unexpected server failure | 500 | (per `InternalServerError`) | Yes — no DB / RLS names | Documented |

All 4xx/5xx responses use `application/problem+json` and reference `#/components/schemas/ProblemDetails`.

## 4. Reusable components used (Section 5)

Inventory taken from `components.responses` and `components.examples`. No new response envelopes were created. Existing components reused:

- Responses: `Unauthorized`, `NotFound`, `Conflict`, `TooManyRequests`, `InternalServerError`.
- Response bodies built inline (schema + examples) for the two operations' `400` and `409` used the existing `ProblemDetails` schema and existing shared examples so that operation-specific error codes could be surfaced without touching the shared `BadRequest` / `Conflict` catch-all envelopes.
- Existing shared examples reused: `ProblemDetailsValidation`, `ProblemDetailsConflict`, `ProblemDetailsInvalidIdempotencyKey`, `ProblemDetailsIdempotencyKeyReused`.

Two new operation-specific examples were added (Section 8 of the mandate explicitly authorises Problem Details examples for `SYSTEM_CATEGORY_PROTECTED` and `CATEGORY_HAS_ACTIVE_DEPENDENCIES`):

- `components.examples.ProblemDetailsSystemCategoryProtected`
- `components.examples.ProblemDetailsCategoryActiveDependencies`

Neither example exposes SQL identifiers, RLS policy names or internal resource IDs. Both use the canonical Problem Details field set (`type`, `title`, `status`, `detail`, `instance`, `code`, `error_id`, `timestamp`).

## 5. Canonical source workflow (Section 6)

The canonical OpenAPI source in this repository is `public/openapi.json`. `public/openapi.yaml` is a derived byte-canonical representation regenerated from the JSON via `scripts/sync-version-artifacts.mjs` (see line 54, `yaml.dump(spec, { lineWidth: 120, noRefs: true })`).

Correction command executed:

```
node scripts/slice-c2a-response-contract-patch.mjs
```

The script edits the canonical JSON in-place and immediately regenerates `public/openapi.yaml` using the same `js-yaml` options as the production sync path so JSON and YAML remain byte-for-byte consistent. No manual YAML editing occurred. No unrelated OpenAPI drift.

## 6. Semantics language (Section 9)

Both operation descriptions were updated to state the logical model truthfully:

- **`budgetingDeleteBudget`** — "Archives the budget. The budget is not physically deleted; historical spending remains intact. Returns 204 on the first successful transition, on a valid same-key idempotent replay, and when the budget is already in the archived terminal state (no repeated mutation, audit event or notification is emitted). 404 is returned when the budget does not exist OR when it exists but lies outside the authenticated caller's authoritative scope (ownership/tenant boundaries are intentionally concealed)."
- **`budgetingDeleteCategory`** — "Soft-deletes an eligible user category. The category is not physically removed; historical transactions retain their category linkage. Returns 204 on the first successful transition, on a valid same-key idempotent replay, and when the category is already in the soft-deleted terminal state (no repeated mutation, audit event or notification is emitted). 404 is returned when the category does not exist OR when it exists but lies outside the authenticated caller's authoritative scope (ownership/tenant boundaries are intentionally concealed). System-managed categories cannot be soft-deleted (409 `SYSTEM_CATEGORY_PROTECTED`). Categories with active dependencies cannot be soft-deleted (409 `CATEGORY_HAS_ACTIVE_DEPENDENCIES`)."

Neither description claims physical deletion, deletion of financial history, restore capability, or category-rule functionality.

## 7. Version and operation integrity

Verified programmatically by `slice-c2a-response-contract-patch.mjs` guardrails and by `src/test/openapi-phase-1b-c2a-contract.test.ts`:

- `spec.info.version` remained `4.53.1` (assertion in patch script + test).
- Operation count remained `484` (assertion in patch script + test).
- `budgetingDeleteRule`, `budgetingDeleteGoal`, `budgetingDisableRoundUp` untouched (no change to their response objects).
- No SDK, Postman, or deployment artifact regenerated.
