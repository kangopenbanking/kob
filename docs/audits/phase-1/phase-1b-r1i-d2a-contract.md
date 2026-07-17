# Phase 1B — R1I-d.2A — Contract

## 1. Applied contract corrections (four operations, additive)

For each of `gatewayListSubaccounts`, `gatewayListBeneficiaries`, `gatewayListPaymentLinks`, `gatewayListVirtualAccounts`:

- `limit` query parameter: `schema.default=25`, `schema.maximum=100`, `schema.minimum=1` guaranteed.
- `cursor` query parameter: added via `#/components/parameters/CursorParam` when not already present (`gatewayListVirtualAccounts` already referenced it; the other three did not).
- Legacy `offset` / `starting_after` / `ending_before` parameters retained per d.2S §2 ("one release" alias policy).
- Response `200.headers` extended with:
  - `X-Pagination-Mode` (enum: `cursor`)
  - `X-Pagination-Has-More` (enum: `true`, `false`)
  - `X-Pagination-Next-Cursor` (string, omitted when no continuation)
  - `X-Pagination-Limit` (integer 1..100)
- Every existing `4xx`/`5xx` response preserved.
- No `operationId`, path, method, security scheme, or version change.

## 2. Preserved invariants (verified after patch)

| Invariant | Verified |
|-----------|----------|
| Operation count | 483 (unchanged; `check-openapi-version.mjs` reports `paths=409` unchanged) |
| API version | 4.53.1 (unchanged) |
| operationId values | unchanged for all four |
| Public paths | unchanged for all four |
| Existing error responses (400/401/403/404/409/429/500) | intact |
| Non-pagination parameters | intact (merchant_id, slug, account_kind) |
| No new operations introduced | ✓ |

## 3. Contract-only decisions honoured

- No universal response envelope introduced.
- No unratified pagination headers.
- No backward pagination.
- No `sort_by` enum expansion.
- Count-drop policy is not in d.2A scope (small merchant-scoped catalogues; medium-volume decision preserved).

## 4. Reproducibility

`scripts/slice-d2a-gateway-pagination-contract.mjs` (JSON) and `scripts/slice-d2a-gateway-pagination-contract-yaml.mjs` (YAML) are idempotent — re-running them is a no-op.

## 5. Quality gates

Before/after `openapi:gates` totals:

| Gate | Before | After |
|------|-------:|------:|
| G1 | 0 | 0 |
| G2 | 3 | 3 |
| G3 | 0 | 0 |
| G4 | 0 | 0 |
| G5 | 29 | 29 |
| G6 | 66 | 66 |
| G7 | 0 | 0 |
| G8 | 0 | 0 |
| G9 | 78 | 78 |
| **Total** | **176** | **176** |

No gate increases; ceiling preserved.
