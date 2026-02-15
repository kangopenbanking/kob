# Kang Open Banking — Gap Report (Checkpoint 2)

> Generated: 2026-02-15

---

## 1. Methodology

- Parsed 4,139-line `public-api-spec` edge function (OpenAPI 3.0.3 served dynamically)
- Parsed 430-line `postman-collection` edge function
- Cross-referenced with 137 implemented edge functions in `supabase/functions/`
- Identified gaps where endpoints exist in one artifact but not others

---

## 2. Summary Statistics

| Metric | Count |
|---|---|
| Edge functions implemented | 137 |
| Paths in OpenAPI spec | ~95 |
| Requests in Postman collection | ~12 |
| Functions in backend but NOT in OpenAPI | ~42 |
| Functions in backend but NOT in Postman | ~125 |
| OpenAPI tags with no paths | 0 (all tags have paths) |
| Endpoints with `/v1` prefix | 0 |
| Endpoints with idempotency support | 0 |
| OpenAPI version | 3.0.3 (target: 3.1) |

---

## 3. Gap Table

### Legend
- ✅ = Present | ❌ = Missing | ⚠️ = Partial

### 3.1 OAuth / Auth / Directory

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `oauth-authorize` | ✅ | ❌ | ✅ | Add to Postman | P1 |
| `oauth-token` | ✅ | ✅ | ✅ | — | — |
| `oauth-introspect` | ✅ | ❌ | ✅ | Add to Postman | P1 |
| `par-endpoint` | ✅ | ❌ | ✅ | Add to Postman | P1 |
| `dcr-register` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `jwks-endpoint` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `oidc-config` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.2 Phone Auth / Security

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `phone-auth-send-otp` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `phone-auth-verify-otp` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `phone-auth-pin-login` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `phone-auth-check-pin` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `pin-code-set` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `pin-code-verify` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `password-reset-with-pin` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `captcha-generate` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `captcha-verify` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `sca-initiate` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `sca-verify` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.3 Certificates (mTLS)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `certificate-upload` | ✅ | ✅ | ✅ | — | — |
| `certificate-list` | ✅ | ✅ | ✅ | — | — |
| `certificate-revoke` | ✅ | ✅ | ✅ | — | — |
| `certificate-expiry-monitor` | ❌ | ❌ | ✅ | Add to OpenAPI (internal/cron) | P3 |

### 3.4 AISP (Account Information)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `aisp-accounts` | ✅ | ✅ | ✅ | — | — |
| `aisp-balances` | ✅ | ✅ | ✅ | — | — |
| `aisp-transactions` | ✅ | ✅ | ✅ | Ensure pagination | P1 |
| `aisp-beneficiaries` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `aisp-standing-orders` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `aisp-direct-debits` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `aisp-create-consent` | ✅ | ❌ | ✅ | Add to Postman | P1 |

### 3.5 PISP (Payment Initiation)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `pisp-create-consent` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `pisp-domestic-payment` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `pisp-payment-submission` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `pisp-payment-details` | ✅ | ❌ | ✅ | Add to Postman | P1 |

### 3.6 Consent Management

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `consent-authorize` | ✅ | ❌ | ✅ | Add to Postman | P1 |
| `consent-revoke` | ✅ | ❌ | ✅ | Add to Postman | P1 |
| `api-consents-list` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.7 Savings

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `savings-create` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `savings-deposit` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `savings-withdraw` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `savings-accrue-interest` | ❌ | ❌ | ❌ | **BUILD** | P1 |

### 3.8 Loans

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `loan-apply` | ✅ | ✅ | ✅ | Add idempotency | P1 |
| `loan-calculate` | ✅ | ✅ | ✅ | — | — |
| `loan-repay` | ✅ | ❌ | ✅ | Add to Postman + idempotency | P1 |
| `loan-approve` | ❌ | ❌ | ❌ | **BUILD** | P1 |
| `loan-disburse` | ❌ | ❌ | ❌ | **BUILD** | P1 |
| `loan-generate-schedule` | ❌ | ❌ | ❌ | **BUILD** | P1 |

### 3.9 Mobile Money

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `mobile-money-charge` | ✅ | ✅ | ✅ | — | — |
| `mobile-money-transfer` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `mobile-money-verify` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `mobile-money-to-bank` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `facilitated-mobile-money-charge` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `facilitated-bank-transfer` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |

### 3.10 Flutterwave / Payments

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `flutterwave-bank-transfer` | ✅ | ❌ | ✅ | Add to Postman | P1 |
| `flutterwave-list-banks` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `flutterwave-verify-bank` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `flutterwave-transfer-webhook` | ❌ | ❌ | ✅ | Add to OpenAPI (webhook) | P2 |

### 3.11 Stripe

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `stripe-payment-intent` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `stripe-confirm-payment` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `stripe-save-card` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |

### 3.12 Credit Scoring

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `credit-score-fetch` | ✅ | ✅ | ✅ | — | — |
| `credit-score-calculate` | ✅ | ✅ | ✅ | — | — |
| `credit-score-simulate` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `credit-score-tips` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `credit-report-generate` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `credit-api-auth` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `credit-api-query-score` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `njangibox-credit-fetch` | ✅ | ❌ | ✅ | Add to Postman | P3 |

### 3.13 CrediQ (Credit Health)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `crediq-health-check` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `crediq-generate-baseline-score` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `crediq-calculate-health-metrics` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `crediq-generate-action-plan` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `crediq-send-welcome-email` | ❌ | ❌ | ✅ | Internal (no public API) | P4 |
| `crediq-send-score-change-email` | ❌ | ❌ | ✅ | Internal | P4 |
| `crediq-send-weekly-digest` | ❌ | ❌ | ✅ | Internal | P4 |
| `crediq-send-monthly-report` | ❌ | ❌ | ✅ | Internal | P4 |
| `crediq-send-goal-achieved-email` | ❌ | ❌ | ✅ | Internal | P4 |

### 3.14 ISO 20022 / SWIFT

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `iso20022-pain001-parser` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `iso20022-camt053-parser` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `iso20022-pacs008-generator` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `iso20022-pacs002-generator` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `swift-mt103-parser` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `swift-mt940-parser` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `swift-mt103-generator` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `validate-iban` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `validate-bic` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.15 Banking Operations

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `bank-sync` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `bank-reconcile` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `bank-import-transactions` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `bank-transaction-webhook` | ❌ | ❌ | ✅ | Internal webhook | P3 |
| `bulk-transfers` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `generate-bank-statement` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `exchange-rate-get` | ✅ | ❌ | ✅ | Add to Postman | P3 |

### 3.16 Virtual Cards

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `virtual-card-create` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `virtual-card-list` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `virtual-card-topup` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `virtual-card-transactions` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `virtual-card-update-status` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.17 Admin

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `admin-create-user` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-create-client` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-metrics` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-sandbox-accounts` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-system-config` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-webhooks` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-transaction-review` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-assign-staff` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-manage-branches` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `admin-clear-test-data` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `admin-rotate-jwt-secret` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `admin-kyb-verify` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `admin-institution-approve` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |

### 3.18 Institution

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `institution-api` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `institution-register` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `institution-create-client` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `business-kyc-submit` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |

### 3.19 KYC / Compliance

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `kyc-submit` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `sanctions-screen` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `gdpr-consent-retention` | ❌ | ❌ | ✅ | Internal cron | P4 |
| `data-export` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.20 PostiQ (Address Verification)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `postiq-create-code` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `postiq-lookup-code` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |

### 3.21 WooCommerce

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `woocommerce-register-merchant` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `woocommerce-payment-webhook` | ❌ | ❌ | ✅ | Internal webhook | P4 |
| `woocommerce-transaction-sync` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `woocommerce-validate-install` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `woocommerce-download-plugin` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `woocommerce-process-payment` | ❌ | ❌ | ✅ | Internal webhook | P4 |

### 3.22 Communications

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `send-communication` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `send-bulk-communication` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `send-invoice-email` | ✅ | ❌ | ✅ | Add to Postman | P3 |

### 3.23 Settlement / Billing

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `settlement-calculate` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `settlement-process` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `generate-invoice` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `automated-billing-cron` | ❌ | ❌ | ✅ | Internal cron | P4 |
| `automated-settlement-cron` | ❌ | ❌ | ✅ | Internal cron | P4 |

### 3.24 Monitoring

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `api-health` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `system-health-check` | ✅ | ❌ | ✅ | Add to Postman | P2 |
| `transaction-monitor` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `health-alert-monitor` | ❌ | ❌ | ✅ | Internal cron | P4 |
| `api-health-collector` | ❌ | ❌ | ✅ | Internal cron | P4 |

### 3.25 Webhooks

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `webhook-delivery` | ✅ | ❌ | ✅ | Add to Postman | P2 |

### 3.26 Sandbox / Testing / Demo

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `sandbox-create-account` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `sandbox-create-api-key` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `sandbox-generate-data` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `sandbox-register-webhook` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `sandbox-test-webhook` | ❌ | ❌ | ✅ | Internal | P4 |
| `sandbox-trigger-webhook` | ❌ | ❌ | ✅ | Internal | P4 |
| `sandbox-validate-api-key` | ❌ | ❌ | ✅ | Internal | P4 |
| `test-data-generator` | ❌ | ❌ | ✅ | Internal | P4 |
| `test-all-templates` | ❌ | ❌ | ✅ | Internal | P4 |
| `load-test-runner` | ❌ | ❌ | ✅ | Internal | P4 |
| `api-demo-proxy` | ❌ | ❌ | ✅ | Internal | P4 |

### 3.27 API Endpoints (Generic/Duplicate)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `api-account-details` | ✅ | ❌ | ✅ | Deprecate (use AISP) | P3 |
| `api-account-detail` | ✅ | ❌ | ✅ | Deprecate (use AISP) | P3 |
| `api-bills` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `api-transfers` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `api-transactions` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `api-verification` | ✅ | ❌ | ✅ | Add to Postman | P3 |
| `api-key-expiration-notifier` | ❌ | ❌ | ✅ | Internal cron | P4 |

### 3.28 Misc

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `ai-anomaly-detection` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |
| `developer-register-app` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P2 |
| `enterprise-contact-submit` | ❌ | ❌ | ✅ | Add to OpenAPI + Postman | P3 |

### 3.29 Ledger (NOT YET BUILT)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `ledger-accounts` | ❌ | ❌ | ❌ | **BUILD** | P1 |
| `journal-post` | ❌ | ❌ | ❌ | **BUILD** | P1 |
| `ledger-balance` | ❌ | ❌ | ❌ | **BUILD** | P1 |

### 3.30 Readiness Probe (NOT YET BUILT)

| Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority |
|---|---|---|---|---|---|
| `api-ready` | ❌ | ❌ | ❌ | **BUILD** | P1 |

---

## 4. Critical Gaps Summary

### Must Build (P1)
1. **`savings-accrue-interest`** — Interest accrual cron job
2. **`loan-approve`** — Admin loan approval
3. **`loan-disburse`** — Loan disbursement with ledger posting
4. **`loan-generate-schedule`** — Amortization schedule generation
5. **`ledger-accounts`** — Chart of accounts management
6. **`journal-post`** — Double-entry journal posting
7. **`ledger-balance`** — Ledger balance queries
8. **`api-ready`** — Readiness probe

### Must Add to All Specs
- **Idempotency** on all write endpoints (0 currently supported)
- **`/v1` prefix** on all paths in OpenAPI (0 currently)
- **Postman collection** has only ~12 requests vs ~95 in OpenAPI

### Legacy Deprecation Plan
- `api-account-details` / `api-account-detail` → deprecate in favor of `aisp-accounts`
- Duplicate function naming (e.g., `facilitated-*` vs `flutterwave-*`) → consolidate under `/v1` routes

---

## 5. OpenAPI Tags Analysis

All 15 defined tags have at least one path:
- `Authentication` ✅, `OAuth` ✅, `Security` ✅, `Certificates` ✅
- `AISP` ✅, `PISP` ✅, `Consent Management` ✅
- `Credit Scoring` ✅, `Loans` ✅, `Savings` ✅
- `Mobile Money` ✅, `Payments` ✅, `Banking Operations` ✅
- `Admin` ✅, `Monitoring` ✅

**Missing tags for implemented domains:**
- CrediQ (9 functions, 0 in spec)
- PostiQ (2 functions, 0 in spec)
- WooCommerce (6 functions, 0 in spec)
- Institution Management (4 functions, 0 in spec)
- Settlement/Billing (5 functions, 0 in spec)
- Ledger (not yet built)
- Virtual Cards (in spec but no tag)
- Sandbox (7 functions, 0 in spec)

---

## 6. Next Steps

Proceed to **Checkpoint 3** — Rewrite OpenAPI spec as 3.1 with `/v1` prefix, add all missing endpoints, schemas, idempotency headers, and examples in XAF.
