# Route Inventory — Kang Open Banking Platform
> Generated: 2026-02-23 | Phase 0 Audit

## Summary
- **Total Edge Functions**: 162
- **Gateway-specific Functions**: 72
- **Core Banking Functions**: 90

## 1. Payment Gateway (`/v1/gateway/*`) — 72 Functions

### Charges
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-charge | POST | /v1/gateway/charges | ✅ Implemented |
| gateway-get-charge | GET | /v1/gateway/charges/:id | ✅ Implemented |
| gateway-list-charges | GET | /v1/gateway/charges | ✅ Implemented |
| gateway-verify-charge | POST | /v1/gateway/charges/:id/verify | ✅ Implemented |
| gateway-cancel-charge | POST | /v1/gateway/charges/:id/cancel | ✅ Implemented |
| gateway-validate-charge | POST | /v1/gateway/charges/:id/validate | ✅ Implemented |
| gateway-preauth-charge | POST | /v1/gateway/charges/preauth | ✅ Implemented |
| gateway-capture-charge | POST | /v1/gateway/charges/:id/capture | ✅ Implemented |
| gateway-void-charge | POST | /v1/gateway/charges/:id/void | ✅ Implemented |
| gateway-charge-token | POST | /v1/gateway/charges/token | ✅ Implemented |
| gateway-get-charge-events | GET | /v1/gateway/charges/:id/events | ✅ Implemented |

### Payouts
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-payout | POST | /v1/gateway/payouts | ✅ Implemented |
| gateway-get-payout | GET | /v1/gateway/payouts/:id | ✅ Implemented |
| gateway-list-payouts | GET | /v1/gateway/payouts | ✅ Implemented |
| gateway-retry-payout | POST | /v1/gateway/payouts/:id/retry | ✅ Implemented |
| gateway-create-payout-batch | POST | /v1/gateway/payout-batches | ✅ Implemented |
| gateway-get-payout-batch | GET | /v1/gateway/payout-batches/:id | ✅ Implemented |

### Refunds
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-refund | POST | /v1/gateway/refunds | ✅ Implemented |
| gateway-get-refund | GET | /v1/gateway/refunds/:id | ✅ Implemented |
| gateway-list-refunds | GET | /v1/gateway/refunds | ✅ Implemented |

### Disputes
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-get-dispute | GET | /v1/gateway/disputes/:id | ✅ Implemented |
| gateway-list-disputes | GET | /v1/gateway/disputes | ✅ Implemented |
| gateway-submit-dispute-evidence | POST | /v1/gateway/disputes/:id/evidence | ✅ Implemented |

### Settlements
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-get-settlement | GET | /v1/gateway/settlements/:id | ✅ Implemented |
| gateway-list-settlements | GET | /v1/gateway/settlements | ✅ Implemented |
| gateway-report-settlements | GET | /v1/gateway/reports/settlements | ✅ Implemented |

### Beneficiaries
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-beneficiary | POST | /v1/gateway/beneficiaries | ✅ Implemented |
| gateway-list-beneficiaries | GET | /v1/gateway/beneficiaries | ✅ Implemented |
| gateway-delete-beneficiary | DELETE | /v1/gateway/beneficiaries/:id | ✅ Implemented |

### Customers & Tokenization
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-customer | POST | /v1/gateway/customers | ✅ Implemented |
| gateway-get-customer | GET | /v1/gateway/customers/:id | ✅ Implemented |
| gateway-update-customer | PATCH | /v1/gateway/customers/:id | ✅ Implemented |
| gateway-list-customers | GET | /v1/gateway/customers | ✅ Implemented |
| gateway-list-customer-tokens | GET | /v1/gateway/customers/:id/tokens | ✅ Implemented |
| gateway-revoke-customer-token | POST | /v1/gateway/customers/:id/tokens/revoke | ✅ Implemented |

### Payment Links
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-payment-link | POST | /v1/gateway/payment-links | ✅ Implemented |
| gateway-get-payment-link | GET | /v1/gateway/payment-links/:slug | ✅ Implemented |
| gateway-list-payment-links | GET | /v1/gateway/payment-links | ✅ Implemented |
| gateway-update-payment-link | PATCH | /v1/gateway/payment-links/:id | ✅ Implemented |
| gateway-delete-payment-link | DELETE | /v1/gateway/payment-links/:id | ✅ Implemented |

### Subscriptions & Plans
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-payment-plan | POST | /v1/gateway/payment-plans | ✅ Implemented |
| gateway-get-payment-plan | GET | /v1/gateway/payment-plans/:id | ✅ Implemented |
| gateway-list-payment-plans | GET | /v1/gateway/payment-plans | ✅ Implemented |
| gateway-update-payment-plan | PATCH | /v1/gateway/payment-plans/:id | ✅ Implemented |
| gateway-create-subscription | POST | /v1/gateway/subscriptions | ✅ Implemented |
| gateway-get-subscription | GET | /v1/gateway/subscriptions/:id | ✅ Implemented |
| gateway-list-subscriptions | GET | /v1/gateway/subscriptions | ✅ Implemented |
| gateway-cancel-subscription | POST | /v1/gateway/subscriptions/cancel | ✅ Implemented |
| gateway-subscription-charge-cron | POST | /v1/gateway/subscriptions/charge-cron | ✅ Implemented |

### Sub-accounts (Split Payments)
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-subaccount | POST | /v1/gateway/subaccounts | ✅ Implemented |
| gateway-get-subaccount | GET | /v1/gateway/subaccounts/:id | ✅ Implemented |
| gateway-list-subaccounts | GET | /v1/gateway/subaccounts | ✅ Implemented |
| gateway-update-subaccount | PATCH | /v1/gateway/subaccounts/:id | ✅ Implemented |

### Virtual Accounts
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-create-virtual-account | POST | /v1/gateway/virtual-accounts | ✅ Implemented |
| gateway-get-virtual-account | GET | /v1/gateway/virtual-accounts/:id | ✅ Implemented |
| gateway-list-virtual-accounts | GET | /v1/gateway/virtual-accounts | ✅ Implemented |

### Merchant Management
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-merchant-keys | POST/GET/DELETE | /v1/gateway/merchant-keys | ✅ Implemented |
| gateway-get-merchant-balance | GET | /v1/gateway/merchants/:id/balance | ✅ Implemented |

### Bank Verification
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-verify-bank-account | POST | /v1/gateway/verify-bank-account | ✅ Implemented |
| gateway-resolve-bvn | POST | /v1/gateway/resolve-bvn | ✅ (Nigeria-only) |

### FX & Fees
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-get-exchange-rate | GET | /v1/gateway/exchange-rate | ✅ Implemented |
| gateway-fee-estimate | GET | /v1/gateway/fee-estimate | ✅ Implemented |

### Reports & Export
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-report-transactions | GET | /v1/gateway/reports/transactions | ✅ Implemented |
| gateway-report-settlements | GET | /v1/gateway/reports/settlements | ✅ Implemented |
| gateway-export-transactions | GET | /v1/gateway/export/transactions | ✅ Implemented |

### Provider Webhooks (Inbound)
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-webhook-flutterwave | POST | /v1/webhooks/providers/flutterwave | ✅ Implemented |
| gateway-webhook-stripe | POST | /v1/webhooks/providers/stripe | ✅ Implemented |

### Outbound Webhook Delivery
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-deliver-webhook | POST | /v1/gateway/webhooks/deliver | ✅ Implemented |

### Reconciliation
| Function | HTTP | Route | Status |
|---|---|---|---|
| gateway-reconcile-stuck | POST | /v1/gateway/reconcile-stuck | ✅ Implemented |

## 2. Core Banking — 90 Functions

### OAuth & Auth (11)
oauth-token, oauth-authorize, oauth-introspect, par-endpoint, dcr-register, oidc-config, jwks-endpoint, phone-auth-send-otp, phone-auth-verify-otp, phone-auth-pin-login, phone-auth-check-pin

### AISP (7)
aisp-create-consent, aisp-accounts, aisp-balances, aisp-transactions, aisp-beneficiaries, aisp-standing-orders, aisp-direct-debits

### PISP (4)
pisp-create-consent, pisp-domestic-payment, pisp-payment-submission, pisp-payment-details

### Consent (3)
consent-authorize, consent-revoke, admin-list-consents

### Credit & CrediQ (10)
credit-score-fetch, credit-score-calculate, credit-score-simulate, credit-score-tips, credit-report-generate, crediq-generate-baseline-score, crediq-calculate-health-metrics, crediq-generate-action-plan, crediq-health-check, credit-api-auth, credit-api-query-score

### Loans (6)
loan-apply, loan-approve, loan-calculate, loan-disburse, loan-repay, admin-list-loans

### Savings (5)
savings-create, savings-deposit, savings-withdraw, savings-accrue-interest, admin-list-savings

### Ledger (3)
ledger-accounts, ledger-balance, journal-post

### Mobile Money (4)
mobile-money-charge, mobile-money-transfer, mobile-money-verify, mobile-money-to-bank

### Payments (5)
stripe-payment-intent, stripe-confirm-payment, stripe-save-card, flutterwave-bank-transfer, flutterwave-list-banks

### ISO 20022 / SWIFT (7)
iso20022-pain001-parser, iso20022-camt053-parser, iso20022-pacs008-generator, iso20022-pacs002-generator, swift-mt103-parser, swift-mt103-generator, swift-mt940-parser

### Admin (15+)
admin-create-user, admin-create-client, admin-metrics, admin-system-config, admin-webhooks, admin-transaction-review, admin-manage-branches, admin-assign-staff, admin-institution-approve, admin-kyb-verify, admin-sandbox-accounts, admin-rotate-jwt-secret, admin-clear-test-data

### Others (10+)
institution-register, institution-api, institution-create-client, kyc-submit, sanctions-screen, data-export, generate-invoice, send-communication, send-bulk-communication, developer-register-app, postiq-create-code, postiq-lookup-code, woocommerce-*, etc.

## 3. Database Tables (Gateway)
| Table | Purpose |
|---|---|
| gateway_merchants | Merchant identity + config |
| gateway_charges | Charges/collections |
| gateway_payouts | Payouts/transfers |
| gateway_refunds | Refunds |
| gateway_disputes | Disputes/chargebacks |
| gateway_settlements | Settlements |
| gateway_beneficiaries | Payout beneficiaries |
| gateway_customers | Customer profiles |
| gateway_customer_tokens | Tokenized payment methods |
| gateway_payment_links | Payment links |
| gateway_payment_plans | Subscription plans |
| gateway_subscriptions | Active subscriptions |
| gateway_subaccounts | Split payment sub-accounts |
| gateway_virtual_accounts | Virtual bank accounts |
| gateway_charge_events | Charge lifecycle timeline |
| gateway_merchant_wallets | Multi-currency wallets |
| gateway_merchant_api_keys | Merchant API keys |
| gateway_webhook_events | Outbound webhook events |
| webhook_inbox | Provider webhook deduplication |
