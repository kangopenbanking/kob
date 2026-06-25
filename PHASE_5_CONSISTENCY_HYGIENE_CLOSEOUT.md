# Phase 5 — Consistency & Hygiene Closeout

**Version**: 4.51.4 → **4.51.5** (patch, additive only)
**Date**: 2026-06-25
**Scope**: Spec-wide rate-limit advertising, 429 Retry-After advertising, and money-amount pattern audit.
**Compliance**: Standing Orders 1 (Lock), 2 (Ratchet), 4 (Surgeon — additive only), 6 (Version Gate).

---

## What shipped

### 1. Rate-limit headers on every response
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` are now referenced on every operation response across both production and sandbox specs. References point at the canonical `#/components/headers/XRateLimit*` definitions — no new component schemas introduced.

- Responses processed: **7,744** (production + sandbox, JSON + YAML).
- Rate-limit header refs added: **3,852**.

### 2. Retry-After on every 429
Every `429 Too Many Requests` response carries `Retry-After` (seconds), referencing `#/components/headers/RetryAfter`.

- 429 responses patched: **50**.

### 3. Money-amount pattern audit
Walked every schema under `components/schemas` and flagged `type: string` fields whose JSON Pointer contains `amount`, `fee`, or `balance`.

- Amount-bearing string fields with the canonical `^[0-9]{1,15}$` pattern: **all confirmed compliant** (per [Zero-Decimal Currency Logic](mem://architecture/zero-decimal-currency-logic)).
- Report-only false positives (non-amount fields that share a substring): `Balance.balance_type`, `Balance.currency`, `Balance.credit_debit_indicator`, `Balance.date_time`, `GatewayCharge.fee_bearer`, `GatewayFeeEstimate.currency`, `GatewayFeeEstimate.channel`, `GatewayFeeEstimate.fee_percentage`. **No action required** — these are enums or descriptive fields, not money values.

### 4. Version + changelog
- `src/config/version.ts` → `4.51.5`.
- `public/openapi.json` and `public/openapi.yaml` `info.version` → `4.51.5`.
- `public/openapi-sandbox.json` and `public/openapi-sandbox.yaml` `info.version` → `4.51.5`.
- `public/changelog.json` apiVersion → `4.51.5` with full entry.

---

## What did **not** change (Standing Order 1 — The Lock)

- Zero `operationId` renames.
- Zero path-key changes.
- Zero schema renames or removals.
- Zero `required[]` removals.
- Zero `enum[]` removals.
- Zero security-scheme changes.
- No new components introduced — all additions reference existing `components/headers/*` definitions.

---

## Re-run

```bash
node scripts/phase5-consistency-hygiene.mjs
```

The script is **idempotent** — re-running emits zero changes once headers are present.

---

## Standards cited

- IETF `draft-ietf-httpapi-ratelimit-headers` — `RateLimit-Limit / Remaining / Reset` advertising.
- RFC 7231 §7.1.3 — `Retry-After` for `429 Too Many Requests`.
- Internal: [Zero-Decimal Currency Logic](mem://architecture/zero-decimal-currency-logic), [API Spec Refinements](mem://architecture/api-spec-refinements).

---

## Phase status

| Phase | Theme                            | Status |
|-------|----------------------------------|--------|
| 1     | Trust & Truthfulness             | ✅ 4.51.1 |
| 2     | Authentication Reality Check     | ✅ 4.51.2 |
| 3     | Scope Containment (x-maturity)   | ✅ 4.51.3 |
| 4     | PCI / Card Data Boundary         | ✅ 4.51.4 |
| **5** | **Consistency & Hygiene**        | **✅ 4.51.5** |

Compliance remediation series complete.
