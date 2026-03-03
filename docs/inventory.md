# Kang Open Banking — Inventory (Checkpoint 1)

> Generated: 2026-02-15

---

## 1. Backend Stack

| Component | Detail |
|---|---|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS |
| **Backend** | Supabase Edge Functions (Deno runtime) |
| **Database** | PostgreSQL (Lovable Cloud / Supabase) |
| **Auth** | Supabase Auth + custom OAuth 2.0 / FAPI 1.0 Advanced |
| **Payments Rail** | Flutterwave, Stripe, Mobile Money |
| **Messaging** | ISO 20022, SWIFT MT103/MT940 |

---

## 2. Environment Variables

### Frontend (.env — auto-managed)
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Project ID |

### Backend Secrets (Supabase Vault)
| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Internal URL |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SUPABASE_DB_URL` | Direct DB connection |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `JWT_SECRET` | JWT signing |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_PUBLIC_KEY` | Stripe publishable |
| `STRIPE_WEBSECRET_KEY` | Stripe webhooks |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave API |
| `FLUTTERWAVE_PUBLIC_KEY` | Flutterwave public |
| `FLUTTERWAVE_ENCRYPTION_KEY` | Flutterwave encryption |
| `RESEND_API_KEY` | Email (Resend) |
| `RESEND_FROM` | From address |
| `VONAGE_API_KEY` | Vonage SMS |
| `VONAGE_API_SECRET` | Vonage SMS |
| `WHATSAPP_API_TOKEN` | WhatsApp |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp |
| `NJANGIBOX_API_KEY` | NjangiBox |
| `NJANGIBOX_API_SECRET` | NjangiBox |
| `NJANGIBOX_BASE_URL` | NjangiBox |
| `POSTIQ_API_KEY` | PostiQ address |
| `POSTIQ_API_SECRET` | PostiQ address |
| `POSTIQ_BASE_URL` | PostiQ address |
| `PUSHER_KEY` | Pusher realtime |
| `PUSHER_SECRET` | Pusher realtime |
| `PUSHER_CLUSTER` | Pusher realtime |
| `LOVABLE_API_KEY` | Lovable AI |

---

## 3. How to Run

- **Frontend**: `npm run dev` (Vite dev server)
- **Edge Functions**: Deploy automatically via Lovable Cloud on file write
- **Database**: Managed by Lovable Cloud; migrations in `supabase/migrations/`
- **Preview**: https://id-preview--342820e7-280a-44d3-88ce-2854c6d907ed.lovable.app
- **Published**: https://kangopenbanking.com

---

## 4. Edge Function Inventory (137 functions)

Legend: ✅ = `verify_jwt = true`, ❌ = `verify_jwt = false` (validates in code or public)

### OAuth / Auth / Directory
| Function | JWT | Notes |
|---|---|---|
| `oauth-authorize` | ❌ | OAuth flow entry |
| `oauth-token` | ❌ | Token issuance |
| `oauth-introspect` | ❌ | Token introspection |
| `par-endpoint` | ❌ | Pushed Authorization Requests |
| `dcr-register` | ❌ | Dynamic Client Registration |
| `jwks-endpoint` | ❌ | Public JWKS |
| `oidc-config` | ❌ | OpenID Connect discovery |

### Certificates (mTLS / FAPI)
| Function | JWT | Notes |
|---|---|---|
| `certificate-upload` | ❌ | Upload client cert |
| `certificate-list` | ❌ | List certs |
| `certificate-revoke` | ❌ | Revoke cert |
| `certificate-expiry-monitor` | ❌ | Cron: check expiry |

### AISP (Account Information)
| Function | JWT | Notes |
|---|---|---|
| `aisp-accounts` | ❌ | List accounts |
| `aisp-balances` | ❌ | Account balances |
| `aisp-transactions` | ❌ | Transaction history |
| `aisp-beneficiaries` | ❌ | Beneficiaries |
| `aisp-standing-orders` | ❌ | Standing orders |
| `aisp-direct-debits` | ❌ | Direct debits |
| `aisp-create-consent` | ❌ | Create AISP consent |

### Consent Management
| Function | JWT | Notes |
|---|---|---|
| `consent-authorize` | ❌ | Authorize consent |
| `consent-revoke` | ❌ | Revoke consent |

### PISP (Payment Initiation)
| Function | JWT | Notes |
|---|---|---|
| `pisp-create-consent` | ❌ | Create payment consent |
| `pisp-domestic-payment` | ❌ | Initiate domestic payment |
| `pisp-payment-details` | ❌ | Get payment details |
| `pisp-payment-submission` | ❌ | Submit payment |

### Flutterwave Integration
| Function | JWT | Notes |
|---|---|---|
| `flutterwave-list-banks` | ❌ | List supported banks |
| `flutterwave-verify-bank` | ❌ | Verify bank account |
| `flutterwave-bank-transfer` | ✅ | Initiate bank transfer |
| `flutterwave-transfer-webhook` | ❌ | Webhook receiver |
| `facilitated-bank-transfer` | — | Facilitated transfer |
| `facilitated-mobile-money-charge` | — | Facilitated MM charge |

### Mobile Money
| Function | JWT | Notes |
|---|---|---|
| `mobile-money-charge` | ✅ | Charge mobile money |
| `mobile-money-transfer` | ❌ | Transfer |
| `mobile-money-verify` | ❌ | Verify transaction |
| `mobile-money-to-bank` | ❌ | MM to bank |

### Stripe
| Function | JWT | Notes |
|---|---|---|
| `stripe-payment-intent` | ✅ | Create payment intent |
| `stripe-confirm-payment` | ❌ | Confirm payment |
| `stripe-save-card` | ❌ | Save card |

### Virtual Cards
| Function | JWT | Notes |
|---|---|---|
| `virtual-card-create` | — | Create virtual card |
| `virtual-card-list` | — | List cards |
| `virtual-card-topup` | — | Top up card |
| `virtual-card-transactions` | — | Card transactions |
| `virtual-card-update-status` | — | Update card status |

### Savings
| Function | JWT | Notes |
|---|---|---|
| `savings-create` | — | Create savings account |
| `savings-deposit` | — | Deposit |
| `savings-withdraw` | — | Withdraw |

### Loans
| Function | JWT | Notes |
|---|---|---|
| `loan-apply` | — | Apply for loan |
| `loan-calculate` | — | Calculate terms |
| `loan-repay` | — | Make repayment |

### Banking Operations
| Function | JWT | Notes |
|---|---|---|
| `bank-sync` | ❌ | Sync bank data |
| `bank-reconcile` | ❌ | Reconciliation |
| `bank-import-transactions` | ❌ | Import transactions |
| `bank-transaction-webhook` | ❌ | Bank webhook |
| `bulk-transfers` | ✅ | Bulk transfers |
| `generate-bank-statement` | ❌ | Generate statement |

### Admin
| Function | JWT | Notes |
|---|---|---|
| `admin-create-user` | ✅ | Create user |
| `admin-create-client` | ✅ | Create API client |
| `admin-metrics` | ✅ | Platform metrics |
| `admin-sandbox-accounts` | ✅ | Sandbox accounts |
| `admin-system-config` | ✅ | System config |
| `admin-webhooks` | ✅ | Manage webhooks |
| `admin-transaction-review` | ✅ | Review transactions |
| `admin-rotate-jwt-secret` | — | Rotate JWT secret |
| `admin-assign-staff` | — | Assign staff |
| `admin-clear-test-data` | — | Clear test data |
| `admin-kyb-verify` | ✅ | KYB verification |
| `admin-institution-approve` | ✅ | Approve institution |
| `admin-manage-branches` | — | Manage branches |

### Institution
| Function | JWT | Notes |
|---|---|---|
| `institution-api` | ✅ | Unified institution API |
| `institution-register` | ✅ | Register institution |
| `institution-create-client` | ✅ | Create inst. client |
| `business-kyc-submit` | ✅ | Submit business KYC |

### KYC / Compliance
| Function | JWT | Notes |
|---|---|---|
| `kyc-submit` | ❌ | Submit KYC |
| `sanctions-screen` | ❌ | Sanctions screening |
| `gdpr-consent-retention` | ❌ | GDPR compliance |
| `transaction-monitor` | ❌ | AML monitoring |

### CrediQ (Credit Scoring)
| Function | JWT | Notes |
|---|---|---|
| `crediq-health-check` | ❌ | Health check |
| `crediq-generate-baseline-score` | ❌ | Baseline score |
| `crediq-calculate-health-metrics` | ❌ | Health metrics |
| `crediq-generate-action-plan` | ❌ | Action plan |
| `crediq-send-welcome-email` | ❌ | Welcome email |
| `crediq-send-score-change-email` | ❌ | Score change email |
| `crediq-send-weekly-digest` | ❌ | Weekly digest |
| `crediq-send-monthly-report` | ❌ | Monthly report |
| `crediq-send-goal-achieved-email` | ❌ | Goal achieved |

### Credit API
| Function | JWT | Notes |
|---|---|---|
| `credit-api-auth` | — | Credit API auth |
| `credit-api-query-score` | — | Query score |
| `credit-report-generate` | — | Generate report |
| `credit-score-calculate` | — | Calculate score |
| `credit-score-fetch` | — | Fetch score |
| `credit-score-simulate` | ✅ | Simulate score |
| `credit-score-tips` | ✅ | Score tips |
| `njangibox-credit-fetch` | — | NjangiBox fetch |

### ISO 20022 / SWIFT
| Function | JWT | Notes |
|---|---|---|
| `iso20022-pain001-parser` | ❌ | pain.001 parser |
| `iso20022-camt053-parser` | ❌ | camt.053 parser |
| `iso20022-pacs008-generator` | ❌ | pacs.008 generator |
| `iso20022-pacs002-generator` | ❌ | pacs.002 generator |
| `swift-mt103-parser` | ❌ | MT103 parser |
| `swift-mt940-parser` | ❌ | MT940 parser |
| `swift-mt103-generator` | ❌ | MT103 generator |
| `validate-iban` | ❌ | IBAN validation |
| `validate-bic` | ❌ | BIC validation |

### PostiQ (Address Verification)
| Function | JWT | Notes |
|---|---|---|
| `postiq-create-code` | ✅ | Create PostiQ code |
| `postiq-lookup-code` | ✅ | Lookup PostiQ code |

### WooCommerce Integration
| Function | JWT | Notes |
|---|---|---|
| `woocommerce-register-merchant` | ✅ | Register merchant |
| `woocommerce-payment-webhook` | ❌ | Payment webhook |
| `woocommerce-transaction-sync` | ✅ | Sync transactions |
| `woocommerce-validate-install` | ❌ | Validate install |
| `woocommerce-download-plugin` | ❌ | Download plugin |
| `woocommerce-process-payment` | ❌ | Process payment |

### Phone Auth / Security
| Function | JWT | Notes |
|---|---|---|
| `phone-auth-send-otp` | ❌ | Send OTP |
| `phone-auth-verify-otp` | ❌ | Verify OTP |
| `phone-auth-check-pin` | — | Check PIN |
| `phone-auth-pin-login` | — | PIN login |
| `pin-code-set` | ❌ | Set PIN |
| `pin-code-verify` | ❌ | Verify PIN |
| `password-reset-with-pin` | ❌ | Password reset |
| `captcha-generate` | ❌ | Generate CAPTCHA |
| `captcha-verify` | ❌ | Verify CAPTCHA |
| `sca-initiate` | ❌ | SCA initiate |
| `sca-verify` | ❌ | SCA verify |

### Settlement & Billing
| Function | JWT | Notes |
|---|---|---|
| `settlement-calculate` | ✅ | Calculate settlement |
| `settlement-process` | ✅ | Process settlement |
| `generate-invoice` | ✅ | Generate invoice |
| `send-invoice-email` | ❌ | Send invoice email |
| `automated-billing-cron` | ❌ | Billing cron |
| `automated-settlement-cron` | ❌ | Settlement cron |

### API Endpoints (Generic)
| Function | JWT | Notes |
|---|---|---|
| `api-account-details` | ❌ | Account details |
| `api-account-detail` | ❌ | Account detail (alt) |
| `api-bills` | ❌ | Bills |
| `api-consents-list` | ❌ | Consents list |
| `api-transfers` | ❌ | Transfers |
| `api-transactions` | ❌ | Transactions |
| `api-verification` | ❌ | Verification |
| `api-health` | ❌ | Health check |
| `api-health-collector` | — | Health collector |
| `api-key-expiration-notifier` | — | Key expiry notifier |
| `api-demo-proxy` | ❌ | Demo proxy |

### Communication
| Function | JWT | Notes |
|---|---|---|
| `send-communication` | ✅ | Send message |
| `send-bulk-communication` | ✅ | Bulk messaging |

### Documentation
| Function | JWT | Notes |
|---|---|---|
| `public-api-spec` | ❌ | OpenAPI spec |
| `postman-collection` | ❌ | Postman collection |
| `openapi-json` | ❌ | OpenAPI JSON |

### Sandbox / Testing
| Function | JWT | Notes |
|---|---|---|
| `sandbox-create-account` | — | Create sandbox account |
| `sandbox-create-api-key` | — | Create sandbox key |
| `sandbox-generate-data` | — | Generate test data |
| `sandbox-register-webhook` | — | Register webhook |
| `sandbox-test-webhook` | — | Test webhook |
| `sandbox-trigger-webhook` | — | Trigger webhook |
| `sandbox-validate-api-key` | — | Validate API key |
| `test-data-generator` | ✅ | Generate test data |
| `test-all-templates` | ✅ | Test templates |
| `load-test-runner` | — | Load testing |

### Data / Misc
| Function | JWT | Notes |
|---|---|---|
| `data-export` | ✅ | Export data |
| `exchange-rate-get` | — | Exchange rates |
| `ai-anomaly-detection` | — | AI anomaly detection |
| `developer-register-app` | — | Developer app register |
| `enterprise-contact-submit` | — | Enterprise contact |

---

## 5. Shared Modules (`supabase/functions/_shared/`)

- `role-middleware.ts` — Role-based auth, rate limiting, audit logging, error responses
- Additional shared utilities for security, mTLS, token validation

---

## 6. Database

- **75+ migrations** in `supabase/migrations/`
- Key tables: `institutions`, `profiles`, `user_roles`, `api_clients`, `client_certificates`, `accounts`, `account_balances`, `transactions`, `payments`, `aisp_consents`, `pisp_consents`, `savings_products`, `savings_accounts`, `savings_transactions`, `loan_products`, `loan_applications`, `audit_logs`, `security_audit_logs`, `compliance_reports`, `rate_limits`, `webhooks`, `webhook_deliveries`, etc.
- Key DB functions: `has_role`, `has_permission`, `check_rate_limit`, `generate_compliance_report`, `calculate_transaction_fee`, `log_audit_event`, `log_security_event`, etc.

---

## 7. Security Notes

- **~100 functions have `verify_jwt = false`** — most validate tokens in code via `role-middleware.ts` or are genuinely public (JWKS, OIDC, webhooks)
- **~30 functions have `verify_jwt = true`** — admin, institution, and sensitive operations
- **~10 functions have no explicit config** — default behavior (not listed in config.toml)
- RLS enabled on `profiles` and `kyc_verifications` tables (recent migration)

---

## 8. Build Verification

- Frontend builds and runs at preview URL ✅
- Edge functions deploy automatically on file write ✅
- Database accessible via Supabase client ✅
