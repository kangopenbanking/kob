# KOB Docs Readiness Baseline — Phase 0

**Date**: 2026-03-22

---

## Developer Portal Content Inventory

| Section | Files | Status |
|---------|-------|--------|
| Portal Home | README.md | ✅ |
| Auth | authentication-overview.md, api-keys.md | ✅ |
| Quickstarts | quickstart-merchant.md, quickstart-platform.md, quickstart-developer-app.md | ✅ |
| Payments | unified-payments.md, payment-methods.md, refunds.md, payouts.md, beneficiaries.md, disputes.md | ✅ |
| Webhooks | webhooks-overview.md, merchant-webhooks.md, provider-webhooks.md | ✅ |
| Reporting | settlements.md, transaction-reports.md, reconciliation.md | ✅ |
| Sandbox | sandbox-overview.md, test-cards-and-momo.md | ⚠️ Missing `test-webhooks.md` |
| Reference | errors.md, idempotency.md, rate-limits.md, versioning-and-changelog.md | ✅ |
| Merchants | merchant-onboarding.md | ✅ |

## Missing Content

| Doc | Priority | Description |
|-----|----------|-------------|
| `sandbox/test-webhooks.md` | P1 | How to test webhooks in sandbox (simulate events, verify signatures) |

## Download Links

| Asset | Location | Status |
|-------|----------|--------|
| OpenAPI JSON (static) | `/openapi.json` | ⚠️ Stale — needs sync |
| OpenAPI JSON (edge fn) | `public-api-spec` function | ✅ Current |
| OpenAPI JSON (dedicated) | `openapi-json` function | ✅ Current |
| Postman collection | `postman-collection` function | ✅ Current |

## API Explorer

| Item | Status |
|------|--------|
| Swagger UI at `/developer/api-explorer` | ✅ Works (JS-rendered) |
| Static fallback at `/developer/api-explorer-static` | ❌ Missing |
| Stable `/openapi.json` URL | ⚠️ Exists but stale |
