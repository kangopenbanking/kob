# OpenAPI Contract Maturity Report (Phase 0, read-only)

**Spec:** `public/openapi.json` v4.26.7 (byte-equivalent to deployed `https://kangopenbanking.com/openapi.json`)
**Operations audited:** 391
**CI gates G1–G5 (`scripts/openapi-quality-gates.mjs`):** ✅ 0 failures

---

## A. 2xx schemas

| Check | Result |
|---|---|
| Operations with a 2xx (excluding 204) and a JSON schema | **391/391 — PASS** |
| Operations with 2xx but no schema | **0** |

No remediation required.

---

## B. Canonical 4xx/5xx coverage

Required set: `400, 401, 403, 404, 409, 429, 500`.

**70 operations** are missing one or more codes. Histogram:

| Missing code | Count |
|---|---|
| 400 | 17 |
| 401 | 12 |
| 403 | 40 |
| 404 | 29 |
| 409 | 66 |
| 429 | 50 |
| 500 | 45 |

### Categorised so we don't over-fix

1. **Public health / discovery endpoints (acceptable as-is)** — `GET /healthz`, `/v1/health`, `/v1/ready`, `/v1/oidc/.well-known/openid-configuration`, `/v1/jwks`, `/v1/.well-known/jwks.json`. These are unauthenticated infrastructure probes. Adding 401/403/404/409/429 to JWKS/health misrepresents the contract. **Recommend keeping current shape.**
2. **OAuth/OIDC standard endpoints** — `/v1/oauth/userinfo`, `/v1/oauth/token`, `/v1/oauth/introspect`. RFC 6749/7662 already define their error envelopes; adding 409/429 should be additive only (rate-limit headers exist).
3. **Domain ops genuinely missing 409/429** — true gaps: e.g. `PATCH /v1/gateway/subscriptions/{subscriptionId}` (missing 403, 409), `DELETE /v1/gateway/subscriptions/{subscriptionId}` (missing 403, 409). These should be backfilled in a Phase 1 patch (additive, no rename).

**Recommended follow-up (additive, patch bump):** add 409/429 references on the ~40 mutation operations under `/v1/gateway/*` that currently omit them; leave health/JWKS/OIDC alone.

---

## C. Idempotency-Key on financial mutations

50 operations match the financial-mutation regex (`charges/refunds/payouts/funding/withdrawals/subscriptions/payment-links/customers/tokens/beneficiaries/disputes/settlements/wallet/transfers/interbank/remittance/bills/loans/savings/piggybank`).

| Result | Count |
|---|---|
| With `Idempotency-Key` header parameter | 45 / 50 |
| **Missing** | **5 / 50** |

### Missing list

| Method | Path | operationId | Recommendation |
|---|---|---|---|
| DELETE | `/v1/gateway/beneficiaries/{beneficiaryId}` | `gatewayDeleteBeneficiary` | Add `Idempotency-Key` (defensive — DELETEs of soft-deletable records benefit from idempotency) |
| DELETE | `/v1/gateway/payment-links/{linkId}` | `gatewayDeletePaymentLink` | Add `Idempotency-Key` |
| DELETE | `/v1/gateway/subscriptions/{subscriptionId}` | `deleteSubscription` | Add `Idempotency-Key` |
| DELETE | `/v1/gateway/subaccounts/{subaccountId}` | `gatewayDeleteSubaccount` | Add `Idempotency-Key` |
| DELETE | `/v1/gateway/customers/{customerId}/tokens/{tokenId}` | `gatewayRevokeCustomerToken` | Add `Idempotency-Key` |

These are all DELETE operations on idempotent-by-nature resources. Spec-side fix: reference `#/components/parameters/IdempotencyKey` (already defined). No code change required (DELETE is naturally idempotent at the DB layer).

The remaining 83 "writes without Idempotency-Key" detected by the broader scanner are auth/security/OTP flows where idempotency keys are inappropriate — not a gap.

---

## D. Pagination consistency

83 list-style GET operations classified by pagination style:

| Style | Count | Examples |
|---|---|---|
| `cursor` only (`starting_after`) | 31 | `/v1/aisp/transactions` (modern path) |
| `offset` only (`offset`+`limit`) | 38 | `/v1/gateway/disputes`, `/v1/gateway/settlements`, `/v1/gateway/beneficiaries`, `/v1/gateway/payment-links`, `/v1/gateway/payment-plans`, `/v1/gateway/subscriptions`, `/v1/gateway/subaccounts`, `/v1/gateway/customers`, `/v1/woocommerce/transactions`, `/v1/ledger/journal` |
| Both | 7 | (legacy + new) |
| Neither | 7 | `/v1/pisp/payments/{paymentId}`, `/v1/admin/metrics`, `/v1/gateway/export/transactions`, `/v1/directory/banks`, `/v1/consents/{consentId}/status`, `/v1/userinfo`, `/v1/banks/{bankId}/connector/mappings` — all are point-lookups or single-resource reads, not lists. **False positive — no fix needed.** |

### Recommendation

`x-pagination` advertises cursor as the standard. **Phase 1 fix (additive, minor bump 4.27.0):** add `starting_after`+`ending_before` to the 38 offset-only ops alongside their existing `offset` parameter. Do not remove `offset` — Standing Order 1.

---

## E. Summary

| Item | State |
|---|---|
| Standing Order 1 (Lock) | ✅ — no renames/removals proposed |
| Standing Order 2 (Ratchet) | ✅ — all gates that previously passed still pass |
| Standing Order 4 (Surgeon — additive only) | ✅ — every recommendation is additive |
| Standing Order 6 (Version Gate) | ⏳ — Phase 1A patch bumps required when fixes land |
| Mandatory CI gates (G1–G5) | ✅ |
| Required-error coverage | ⚠️ ~40 truly impacted ops (Phase 1B) |
| Idempotency on financial mutations | ⚠️ 5 DELETE ops (Phase 1A) |
| Cursor pagination on list ops | ⚠️ 38 ops (Phase 1C, minor bump) |

No Phase 0 STOP-POINT failures. Proceed to Phase 1 only after explicit approval.
