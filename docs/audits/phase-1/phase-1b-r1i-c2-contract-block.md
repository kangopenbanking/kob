# Phase 1B-R1I-c.2 — Contract Response Decision Required (BLOCKED)

**Status:** BLOCKED — no runtime code, tests, guards, migrations, or reports beyond this decision record were produced.

**Prohibitions honoured this turn:**
- No changes under `src/`, `supabase/functions/`, `supabase/migrations/`, or `public/openapi.*`.
- No production migration, deployment, SDK/Postman publication, version increment, or operation-count change.
- API remains **4.53.1**, operations **484**, release status **Unreleased**, gates **187**, Rollup **4.44.2**.

## 1. Preflight — contract inspection

Extracted directly from the canonical `public/openapi.json` (API 4.53.1, unreleased):

| Operation | Method | Path | Documented responses | IdempotencyKeyHeader ref | Request body |
|---|---|---|---|---|---|
| `budgetingDeleteBudget` | DELETE | `/v1/budgeting/budgets/{budgetId}` | `204` only | present (optional) | none |
| `budgetingDeleteCategory` | DELETE | `/v1/budgeting/categories/{categoryId}` | `204` only | present (optional) | none |

Neither operation declares `default`, `4XX`, `400`, `401`, `403`, `404`, or `409`. No shared error `$ref` is attached at the operation level.

## 2. Ratified c.2 semantics vs. contract

The C.0A role-ratification package and c.0 semantics decision approved:

| Required runtime behaviour | Required HTTP outcome | Present in 4.53.1 contract? |
|---|---|---|
| Missing / invalid bearer token | `401` | ❌ |
| Malformed `budgetId` / `categoryId` (non-UUID) | `400` | ❌ |
| Non-owner / cross-tenant caller | `403` or `404` (repo policy) | ❌ |
| Archived budget already in terminal state | `204` or `409` (per approved semantics) | Only `204` documented |
| Soft-deleted category already in terminal state | `204` or `409` (per approved semantics) | Only `204` documented |
| `is_system = true` category protection | `403` or `409` | ❌ |
| Active category dependency (ratified: reject with conflict) | `409` | ❌ |
| Malformed `Idempotency-Key` (not UUID v4) | `400` (`IDEMPOTENCY_KEY_INVALID`) | ❌ |
| Public UUID v5 supplied as `Idempotency-Key` | `400` | ❌ |
| Same key + different request | `409` (`IDEMPOTENCY_KEY_REUSED`) | ❌ |
| Same key + concurrent request | `409` (`IDEMPOTENCY_KEY_IN_FLIGHT`) | ❌ |

## 3. Governance constraint

- Section 4 of the R1I-c.2 mandate: *"Do not invent an undocumented response."*
- Section 4 of the R1I-c.2 mandate: *"Do not modify OpenAPI during R1I-c.2."*
- Prohibited-operations list of this authorization: **OpenAPI modification**, **operation-count change**, **version increment**.
- Guardian Standing Order 2 (Ratchet): documented response codes are additive — they can only be added under a fresh contract slice with a Version Gate increment.

Implementing the ratified semantics without additional documented responses would require the handler to either:
(a) return status codes that the contract does not permit (violates *"remain compatible with the current unreleased contract"* and Standing Order 4), or
(b) collapse every non-success path into `204` (violates the ratified semantics: system protection, dependency conflict, ownership isolation, idempotency conflict all become invisible to callers), or
(c) modify OpenAPI to add the missing responses (explicitly prohibited by this authorization).

All three options are disallowed. This is the exact condition Section 4 requires to be surfaced as BLOCKED.

## 4. Decision required from Chief Architect + Guardian

A separate, appropriately-authorized contract slice (proposed name: **R1I-c.2-contract**) is required before c.2 runtime work can proceed. That slice must add — additively, under Standing Order 4 (Surgeon Rule) and Standing Order 6 (Version Gate) — the following documented responses to both DELETE operations:

- `400` — `ProblemDetails` (validation, `IDEMPOTENCY_KEY_INVALID`)
- `401` — `ProblemDetails` (unauthenticated)
- `403` — `ProblemDetails` (forbidden / system-category)
- `404` — `ProblemDetails` (not found / cross-tenant)
- `409` — `ProblemDetails` (`IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_KEY_IN_FLIGHT`, `CATEGORY_HAS_ACTIVE_DEPENDENCIES`, terminal-state conflict per ratified semantics)

Because these are additive to an **Unreleased** contract, they qualify as a patch increment (`4.53.1 → 4.53.2`) under Standing Order 6, not a breaking change. Operation count is unchanged.

Once the contract slice is authorized, executed, and the OpenAPI gate baseline is re-anchored, R1I-c.2 runtime implementation can proceed against a truthful contract.

## 5. Verification of hands-off

- Working tree: no edits under `src/`, `supabase/functions/`, `supabase/migrations/`, `public/openapi.*`.
- Only file created this turn: this decision record (documentation only).
- OpenAPI JSON/YAML unchanged; SHA of `public/openapi.json` unchanged.
- Version: `4.53.1`. Operations: `484`. Gates: `187`. Rollup: `4.44.2`. Lockfile hash unchanged.
- Canonical pending migration `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql` unchanged (SHA-256 `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`).
- Financial-history tables not touched.

## 6. Gate

PHASE 1B-R1I-c.2 BLOCKED — CONTRACT RESPONSE DECISION REQUIRED
