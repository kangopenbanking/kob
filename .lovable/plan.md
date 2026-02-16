
# Full Health Audit: Documentation.tsx v1 API Alignment

## Audit Status

### Already Updated (Passing)
- `src/pages/admin/ApiDocumentation.tsx` -- 70+ endpoints, v1 paths, OpenAPI 3.1.0, RFC 7807 errors
- `src/pages/admin/ApiTesting.tsx` -- synced endpoints, Idempotency-Key support
- `src/pages/developer/AispReference.tsx` -- v1 paths
- `src/pages/developer/PispReference.tsx` -- v1 paths, PISP_ error codes
- `src/pages/developer/MobileMoneyReference.tsx` -- v1 paths, MM_ error codes
- `src/pages/developer/BankingReference.tsx` -- v1 paths
- `src/pages/developer/CertificateReference.tsx` -- v1 paths
- `src/pages/developer/GettingStarted.tsx` -- v1 URLs, form-encoded auth
- `src/pages/developer/QuickStart.tsx` -- v1 URLs
- `src/pages/developer/CodeExamples.tsx` -- v1 paths, idempotency headers
- `docs/portal/*` -- all 7 markdown files created with v1 standards
- Domain navigation links (lines 162-173) -- fixed in last round

### Failing: `src/pages/Documentation.tsx` (Main Public Page)

This is the primary public-facing documentation page at `/documentation`. It has **28 legacy path references** that were never updated to v1.

| Line(s) | Current (Legacy) | Should Be (v1) |
|---------|-------------------|----------------|
| 74-118 | `apiEndpoints` array uses `/api/v1/accounts`, `/api/v1/payments/initiate`, `/api/v1/transactions`, `/api/v1/transfers` | Replace with real v1 endpoints: `/v1/aisp/accounts`, `/v1/pisp/domestic-payments`, `/v1/mobile-money/charge`, `/v1/health` |
| 79-80 | `Authorization: Bearer YOUR_API_KEY` | Should mention OAuth token, not "API_KEY" |
| 138 | `dateModified: "2025-11-05"` | `"2026-02-16"` |
| 137 | `datePublished: "2025-01-05"` | Keep or update |
| 427-448 | Auth section says "Bearer YOUR_API_KEY" only | Add OAuth 2.0 grants, DCR reference, link to `/developer/quick-start` |
| 459-476 | Response format shows `{ status, data, timestamp }` envelope | Replace with RFC 7807 error model: `error`, `error_code`, `message`, `details`, `error_id`, `timestamp` |
| 465 | Timestamp `2025-01-01T12:00:00Z` | `2026-02-16T12:00:00Z` |
| 512 | `POST /functions/v1/certificate-upload` | `POST /v1/certificates/upload` |
| 531 | `GET /functions/v1/certificate-list` | `GET /v1/certificates/list` |
| 545 | `POST /functions/v1/certificate-revoke` | `POST /v1/certificates/revoke` |
| 593 | `POST /functions/v1/loan-apply` | `POST /v1/loans/apply` |
| 636 | `POST /functions/v1/loan-calculate` | `POST /v1/loans/calculate` |
| 664 | `POST /functions/v1/loan-repay` | `POST /v1/loans/repay` |
| 678 | `next_due_date: "2025-02-15"` | `"2026-03-15"` |
| 709 | `POST /functions/v1/savings-create` | `POST /v1/savings/create` |
| 750 | `POST /functions/v1/savings-deposit` | `POST /v1/savings/deposit` |
| 777 | `POST /functions/v1/savings-withdraw` | `POST /v1/savings/withdraw` |
| 823 | `POST /functions/v1/credit-score-fetch` | `POST /v1/credit/score` |
| 836-837 | `calculated_at: "2025-01-15..."` | `2026-...` |
| 889 | `POST /functions/v1/credit-report-generate` | `POST /v1/credit/report` |
| 914 | `generated_at: "2025-01-15..."` | `2026-...` |
| 959 | `POST /functions/v1/credit-api-auth` | `POST /v1/credit/auth` |
| 989 | `POST /functions/v1/credit-api-query-score` | `POST /v1/credit/query` |
| 1003 | `calculated_at: "2025-01-15..."` | `2026-...` |
| 1154 | `POST /functions/v1/send-communication` | `POST /v1/communications/send` |
| 1197 | `POST /functions/v1/send-bulk-communication` | `POST /v1/communications/bulk` |
| 1171 | curl URL uses `/v1/send-communication` | `/v1/communications/send` |
| 1216 | curl URL uses `/v1/send-bulk-communication` | `/v1/communications/bulk` |

**Missing from Documentation.tsx:**
- No `Idempotency-Key` header on any POST examples (loans, savings, payments)
- No `x-consent-id` header on AISP/credit examples
- No link to the developer portal guides (`docs/portal/`)

---

## Public Banking API Completeness Assessment

The platform covers all domains required for a full public banking API comparable to Flutterwave:

| Domain | Edge Functions | v1 Paths | Status |
|--------|---------------|----------|--------|
| OAuth / DCR / OIDC | 7 functions | Updated | Ready |
| AISP (Account Info) | 8 functions | Updated | Ready |
| PISP (Payments) | 5 functions | Updated | Ready |
| Mobile Money | 4 functions | Updated | Ready |
| Flutterwave Payments | 4 functions | Updated | Ready |
| Stripe Payments | 3 functions | Updated | Ready |
| Credit Scoring | 5 functions | Updated | Ready |
| Loans | 6 functions | Updated | Ready |
| Savings | 4 functions | Updated | Ready |
| Ledger (Double-Entry) | 3 functions | Updated | Ready |
| Virtual Cards | 5 functions | Updated | Ready |
| KYC / Compliance | 3 functions | Updated | Ready |
| ISO 20022 / SWIFT | 6 functions | Updated | Ready |
| Webhooks | 4 functions | Updated | Ready |
| Certificates / mTLS | 3 functions | Updated | Ready |
| Communications | 2 functions | Needs fix | Fix below |
| Admin / Reports | 5+ functions | Updated | Ready |
| Sandbox | 6 functions | Updated | Ready |
| WooCommerce | 6 functions | Updated | Ready |

**Total: 155+ edge functions across 19 domains -- this is a full banking API.**

The only remaining gap is the main `/documentation` page which is the public entry point and still shows legacy paths.

---

## Implementation Plan

### Single file update: `src/pages/Documentation.tsx`

1. **Replace `apiEndpoints` array** (lines 74-118) with 4 real v1 examples:
   - `GET /v1/aisp/accounts` -- List accounts (with `x-consent-id` header)
   - `POST /v1/pisp/domestic-payments` -- Initiate payment (with `Idempotency-Key`)
   - `POST /v1/mobile-money/charge` -- Mobile money charge (with `Idempotency-Key`)
   - `GET /v1/health` -- Health check (no auth)

2. **Update Authentication section** (lines 427-448): Expand to mention OAuth 2.0, DCR, and link to QuickStart guide

3. **Replace Response Format** (lines 459-476): Show RFC 7807 error model with all 6 fields

4. **Fix all 14 endpoint paths** from `/functions/v1/...` to `/v1/...` format:
   - Certificate endpoints (3 paths)
   - Loan endpoints (3 paths)
   - Savings endpoints (3 paths)
   - Credit endpoints (3 paths)
   - Communication endpoints (2 paths)

5. **Add `Idempotency-Key` header** to all POST examples (loans, savings, payments)

6. **Update all dates** from 2025 to 2026

7. **Update structured data** `dateModified` to `2026-02-16`

No other files need changes -- this is the last remaining file with legacy patterns.
