# KOB v1 — Feature Matrix

> Generated: 2026-03-15 | Version: 6.0.0
> Legend: ✅ Implemented | ⚠️ Partial | ❌ Missing | N/A Not Applicable

## Identity & Onboarding

| Feature | Institution | Merchant | Developer | Admin | Personal |
|---|---|---|---|---|---|
| Registration flow | ✅ | ✅ | ✅ | ✅ | ✅ |
| PIN setup (6-digit) | ✅ | ✅ | ✅ | ✅ | ✅ |
| PIN login | ✅ | ✅ | ✅ | ✅ | ✅ |
| OTP (SMS/WhatsApp) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Email verification | ✅ | ✅ | ✅ | ✅ | ✅ |
| KYB submission | ✅ | ✅ | N/A | N/A | N/A |
| KYC submission | N/A | N/A | N/A | N/A | ✅ |
| Admin KYB review | N/A | N/A | N/A | ✅ | N/A |
| Admin KYC review | N/A | N/A | N/A | ✅ | N/A |
| RBAC enforcement | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenant isolation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit logging | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard routing | ✅ | ✅ | ✅ | ✅ | ✅ |

## OAuth / OIDC / Security

| Feature | Institution | Merchant | Developer | Admin | Provider |
|---|---|---|---|---|---|
| OAuth token (client_credentials) | ✅ | N/A | ✅ | N/A | N/A |
| OAuth token (authorization_code) | ✅ | N/A | ✅ | N/A | N/A |
| Refresh token rotation | ✅ | N/A | ✅ | N/A | N/A |
| Token introspection | ✅ | N/A | ✅ | N/A | N/A |
| Token revocation | ✅ | N/A | ✅ | N/A | N/A |
| DCR (Dynamic Client Reg) | ✅ | N/A | ✅ | N/A | N/A |
| PAR (Pushed Auth Requests) | ✅ | N/A | ✅ | N/A | N/A |
| PKCE (S256) | ✅ | N/A | ✅ | N/A | N/A |
| mTLS / Cert-bound tokens | ✅ | N/A | ⚠️ | N/A | N/A |
| JWKS endpoint | ✅ | N/A | ✅ | N/A | N/A |
| OIDC discovery | ✅ | N/A | ✅ | N/A | N/A |
| SCA (Strong Customer Auth) | ✅ | N/A | ✅ | N/A | N/A |
| CAPTCHA verification | ✅ | ✅ | ✅ | ✅ | N/A |
| Brute-force lockout | ✅ | ✅ | ✅ | ✅ | ✅ |

## AISP (Account Information)

| Feature | Status | Edge Function | Postman | OpenAPI |
|---|---|---|---|---|
| Create consent | ✅ | aisp-create-consent | ✅ | ✅ |
| Authorize consent | ✅ | consent-authorize | ✅ | ✅ |
| Revoke consent | ✅ | consent-revoke | ✅ | ✅ |
| List accounts | ✅ | aisp-accounts | ✅ | ✅ |
| Account detail | ✅ | aisp-accounts | ✅ | ✅ |
| Balances | ✅ | aisp-balances | ✅ | ✅ |
| Transactions | ✅ | aisp-transactions | ✅ | ✅ |
| Beneficiaries | ✅ | aisp-beneficiaries | ✅ | ✅ |
| Standing orders | ✅ | aisp-standing-orders | ✅ | ✅ |
| Direct debits | ✅ | aisp-direct-debits | ✅ | ✅ |

## PISP (Payment Initiation)

| Feature | Status | Edge Function | Postman | OpenAPI |
|---|---|---|---|---|
| Create payment consent | ✅ | pisp-create-consent | ✅ | ✅ |
| Domestic payment | ✅ | pisp-domestic-payment | ✅ | ✅ |
| Payment submission | ✅ | pisp-payment-submission | ✅ | ✅ |
| Payment status | ✅ | pisp-payment-details | ✅ | ✅ |

## Payment Gateway (Merchant)

| Feature | Status | Edge Function | Postman | OpenAPI |
|---|---|---|---|---|
| Create charge | ✅ | gateway-create-charge | ✅ | ✅ |
| Get charge | ✅ | gateway-query | ✅ | ✅ |
| List charges | ✅ | gateway-query | ✅ | ✅ |
| Verify charge | ✅ | gateway-verify-charge | ✅ | ✅ |
| Cancel charge | ✅ | gateway-cancel-charge | ✅ | ✅ |
| Void charge | ✅ | gateway-void-charge | ✅ | ✅ |
| Pre-auth charge | ✅ | gateway-preauth-charge | ✅ | ✅ |
| Capture charge | ✅ | gateway-capture-charge | ✅ | ✅ |
| Fee estimate | ✅ | gateway-fee-estimate | ✅ | ✅ |
| Create refund | ✅ | gateway-create-refund | ✅ | ✅ |
| Get/List refunds | ✅ | gateway-query | ✅ | ✅ |
| Create payout | ✅ | gateway-create-payout | ✅ | ✅ |
| Get/List payouts | ✅ | gateway-query | ✅ | ✅ |
| Batch payouts | ✅ | gateway-create-payout-batch | ✅ | ✅ |
| Instant payouts | ✅ | gateway-instant-payout | ⚠️ | ⚠️ |
| Push-to-card | ✅ | gateway-push-to-card | ⚠️ | ⚠️ |
| Beneficiaries CRUD | ✅ | gateway-create/delete-beneficiary | ✅ | ✅ |
| Payment links | ✅ | gateway-create-payment-link | ✅ | ✅ |
| Payment plans | ✅ | gateway-create-payment-plan | ✅ | ✅ |
| Subscriptions | ✅ | gateway-create-subscription | ✅ | ✅ |
| Sub-accounts | ✅ | gateway-create-subaccount | ✅ | ✅ |
| Customers | ✅ | gateway-create-customer | ✅ | ✅ |
| Customer tokens | ✅ | gateway-charge-token | ✅ | ✅ |
| Virtual accounts | ✅ | gateway-create-virtual-account | ✅ | ✅ |
| Verify bank account | ✅ | gateway-verify-bank-account | ✅ | ✅ |
| Resolve BVN | ✅ | gateway-resolve-bvn | ✅ | ✅ |
| Exchange rate | ✅ | gateway-get-exchange-rate | ✅ | ✅ |
| Disputes | ✅ | gateway-query | ✅ | ✅ |
| Dispute evidence | ✅ | gateway-submit-dispute-evidence | ✅ | ✅ |
| Settlements | ✅ | gateway-query | ✅ | ✅ |
| Transaction report | ✅ | gateway-report-transactions | ✅ | ✅ |
| Settlement report | ✅ | gateway-report-settlements | ✅ | ✅ |
| CSV export | ✅ | gateway-export-transactions | ✅ | ✅ |

## Payment Gateway — New Modules (Post-Audit)

| Feature | Status | Edge Function | Postman | OpenAPI |
|---|---|---|---|---|
| Wallets (merchant) | ✅ | gateway-wallets | ⚠️ → ✅ | ⚠️ → ✅ |
| Escrow wallets | ✅ | gateway-escrow-wallets | ⚠️ → ✅ | ⚠️ → ✅ |
| Instant payouts | ✅ | gateway-instant-payout | ⚠️ → ✅ | ⚠️ → ✅ |
| Treasury | ✅ | gateway-treasury | ⚠️ → ✅ | ⚠️ → ✅ |
| Compliance screening | ✅ | gateway-compliance-screen | ⚠️ → ✅ | ⚠️ → ✅ |
| SLA monitoring | ✅ | gateway-sla-monitor | ⚠️ → ✅ | ⚠️ → ✅ |
| Safeguarding ledger | ✅ | gateway-safeguarding-ledger | ⚠️ → ✅ | ⚠️ → ✅ |
| SAR (Suspicious Activity) | ✅ | gateway-sar | ⚠️ → ✅ | ⚠️ → ✅ |

## Provider Adapters & Webhooks

| Provider | Charge | Payout | Webhook Ingest | Sig Verify | Dedup |
|---|---|---|---|---|---|
| Flutterwave (MoMo) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Flutterwave (Bank) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stripe (Card) | ✅ | ✅ | ✅ | ✅ | ✅ |
| PayPal | ✅ | ✅ | ✅ | ✅ | ✅ |

## Ledger & Double-Entry

| Feature | Status | Edge Function |
|---|---|---|
| List ledger accounts | ✅ | ledger-accounts |
| Create ledger account | ✅ | ledger-accounts |
| Get ledger balance | ✅ | ledger-balance |
| Journal posting | ✅ | journal-post |
| List journal entries | ✅ | journal-post |
| Atomic charge→wallet credit | ✅ | atomic_charge_wallet_credit (SQL) |
| Atomic refund→wallet debit | ✅ | atomic_refund_wallet_debit (SQL) |

## Loans

| Feature | Status | Edge Function |
|---|---|---|
| List products | ✅ | loan-ops |
| Apply for loan | ✅ | loan-ops |
| Calculate schedule | ✅ | loan-ops |
| Approve loan | ✅ | loan-ops |
| Disburse loan | ✅ | loan-ops |
| Get schedule | ✅ | loan-ops |
| Repay installment | ✅ | loan-ops |
| Overdue detection | ✅ | loan-ops |

## Savings

| Feature | Status | Edge Function |
|---|---|---|
| List products | ✅ | savings-ops |
| Create account | ✅ | savings-ops |
| Deposit | ✅ | savings-ops |
| Withdraw | ✅ | savings-ops |
| Accrue interest | ✅ | savings-ops |

## Credit Scoring (CrediQ)

| Feature | Status | Edge Function |
|---|---|---|
| Get profile | ✅ | credit-profile-get |
| List events | ✅ | credit-events-list |
| Explain score | ✅ | credit-explain |
| Recompute score | ✅ | credit-recompute |
| Baseline score | ✅ | crediq-generate-baseline-score |
| Health metrics | ✅ | crediq-calculate-health-metrics |
| Action plan | ✅ | crediq-generate-action-plan |

## POS & Commerce

| Feature | Status | Edge Function |
|---|---|---|
| Catalog products | ✅ | pos-catalog-products |
| Inventory management | ✅ | pos-inventory |
| Inventory sync (Woo) | ✅ | pos-inventory-sync |
| Order management | ✅ | pos-orders |
| POS payment (QR) | ✅ | pos-qr-payment |
| Store browse (marketplace) | ✅ | pos-store-browse |
| Store subscriptions | ✅ | pos-store-subscription |
| Consumer cart/checkout | ✅ | pos-consumer-cart/checkout |
| WooCommerce connector | ✅ | pos-woo-connector |
| WooCommerce webhook | ✅ | pos-woo-webhook-ingestion |

## Standards (ISO 20022 / SWIFT)

| Feature | Status | Edge Function |
|---|---|---|
| pain.001 parse | ✅ | iso-messaging |
| camt.053 parse | ✅ | iso-messaging |
| pacs.008 generate | ✅ | iso-messaging |
| pacs.002 generate | ✅ | iso-messaging |
| MT103 parse/generate | ✅ | iso-messaging |
| MT940 parse | ✅ | iso-messaging |
| Validate BIC | ✅ | validate-bic |
| Validate IBAN | ✅ | validate-iban |
| Validate RIB | ✅ | validate-rib |
| Validate account identifier | ✅ | validate-account-identifier |

## Admin Portal

| Feature | Status |
|---|---|
| User management | ✅ |
| Institution management | ✅ |
| Merchant management | ✅ |
| KYB/KYC review queue | ✅ |
| TPP review | ✅ |
| Transaction monitoring | ✅ |
| Settlement management | ✅ |
| Dispute management | ✅ |
| System config | ✅ |
| Metrics dashboard | ✅ |
| Audit logs | ✅ |
| Branch management | ✅ |
| Compliance reports | ✅ |
| Webhook management | ✅ |
| Notification pipeline | ✅ |
| Unified onboarding queue | ✅ |
| Access role management | ✅ |
| Command palette (⌘K) | ✅ |

## Notifications

| Feature | Status |
|---|---|
| KYB submitted → admin | ✅ |
| KYB approved/rejected → user | ✅ |
| KYC status change → user | ✅ |
| Transaction → user | ✅ |
| Balance change → user | ✅ |
| Bank transfer status → user | ✅ |
| Mobile money status → user | ✅ |
| Store published/unpublished → merchant | ✅ |
| Subscription activated/expired → merchant | ✅ |
| Translation pipeline (EN/FR) | ✅ |

## Observability

| Feature | Status |
|---|---|
| Health check (`/v1/health`) | ✅ |
| Readiness probe (`/v1/ready`) | ✅ |
| System health (detailed) | ✅ |
| API health collector (cron) | ✅ |
| Health alert monitor | ✅ |
| SLA monitor | ✅ |
| Error IDs on all responses | ✅ |
| Structured logging | ✅ |
| Audit trail (audit_logs) | ✅ |
| Security audit logs | ✅ |
