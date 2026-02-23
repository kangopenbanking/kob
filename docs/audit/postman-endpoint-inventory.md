# Postman Collection Endpoint Inventory
> Generated: 2026-02-23 | Source: postman-collection edge function

## Collection: Kang Open Banking API v1
Version: 1.0.0

### Folder: Monitoring (3 requests)
1. GET /v1/health
2. GET /v1/ready
3. GET /v1/system-health

### Folder: OAuth (6 requests)
1. POST /v1/oauth/token
2. POST /v1/oauth/introspect
3. POST /v1/oauth/par
4. POST /v1/dcr/register
5. GET /v1/oidc/.well-known/openid-configuration
6. GET /v1/jwks

### Folder: Authentication (6 requests)
1. POST /v1/auth/phone/send-otp
2. POST /v1/auth/phone/verify-otp
3. POST /v1/auth/phone/pin-login
4. POST /v1/auth/pin/set
5. POST /v1/auth/pin/verify
6. POST /v1/auth/password/reset-with-pin

### Folder: Security (4 requests)
1. POST /v1/security/captcha/generate
2. POST /v1/security/captcha/verify
3. POST /v1/security/sca/initiate
4. POST /v1/security/sca/verify

### Folder: Certificates (3 requests)
1. POST /v1/certificates
2. GET /v1/certificates
3. POST /v1/certificates/revoke

### Folder: AISP (8 requests)
1. POST /v1/aisp/consents
2. GET /v1/aisp/accounts
3. GET /v1/aisp/accounts/:id
4. GET /v1/aisp/accounts/:id/balances
5. GET /v1/aisp/accounts/:id/transactions
6. GET /v1/aisp/accounts/:id/beneficiaries
7. GET /v1/aisp/accounts/:id/standing-orders
8. GET /v1/aisp/accounts/:id/direct-debits

### Folder: PISP (4 requests)
1. POST /v1/pisp/consents
2. POST /v1/pisp/domestic-payment
3. POST /v1/pisp/payment-submission
4. GET /v1/pisp/payments/:id

### Folder: Consent Management (3 requests)
1. POST /v1/consents/:id/authorize
2. POST /v1/consents/:id/revoke
3. GET /v1/consents

### Folder: Credit Scoring (5 requests)
1. GET /v1/credit/score
2. POST /v1/credit/score
3. POST /v1/credit/simulate
4. GET /v1/credit/tips
5. POST /v1/credit/report

### Folder: Loans (7 requests)
1. GET /v1/loans/products
2. POST /v1/loans/apply
3. POST /v1/loans/calculate
4. POST /v1/loans/:id/approve
5. POST /v1/loans/:id/disburse
6. GET /v1/loans/:id/schedule
7. POST /v1/loans/:id/repay

### Folder: Savings (5 requests)
1. GET /v1/savings/products
2. POST /v1/savings/accounts
3. POST /v1/savings/accounts/:id/deposit
4. POST /v1/savings/accounts/:id/withdraw
5. POST /v1/savings/accrue-interest

### Folder: Ledger (5 requests)
1. GET /v1/ledger/accounts
2. POST /v1/ledger/accounts
3. GET /v1/ledger/accounts/:id/balance
4. POST /v1/ledger/journal
5. GET /v1/ledger/journal

### Folder: Mobile Money (4 requests)
1. POST /v1/mobile-money/charge
2. POST /v1/mobile-money/transfer
3. POST /v1/mobile-money/verify
4. POST /v1/mobile-money/to-bank

### Folder: Payments (4 requests)
1. POST /v1/payments/stripe/intent
2. POST /v1/payments/stripe/confirm
3. POST /v1/payments/flutterwave/bank-transfer
4. GET /v1/payments/flutterwave/banks

### Folder: Banking Operations (2 requests)
1. POST /v1/banking/bulk-transfers
2. GET /v1/banking/exchange-rate

### Folder: Virtual Cards (5 requests)
1. POST /v1/virtual-cards
2. GET /v1/virtual-cards
3. PUT /v1/virtual-cards/:id/status
4. POST /v1/virtual-cards/:id/topup
5. GET /v1/virtual-cards/:id/transactions

### Folder: Standards (ISO 20022 / SWIFT) (9 requests)
1. POST /v1/standards/iso20022/pain001/parse
2. POST /v1/standards/iso20022/camt053/parse
3. POST /v1/standards/iso20022/pacs008/generate
4. POST /v1/standards/iso20022/pacs002/generate
5. POST /v1/standards/swift/mt103/parse
6. POST /v1/standards/swift/mt103/generate
7. POST /v1/standards/swift/mt940/parse
8. POST /v1/standards/validate-bic
9. POST /v1/standards/validate-iban

### Folder: KYC & Compliance (3 requests)
1. POST /v1/kyc/submit
2. POST /v1/kyc/sanctions-screen
3. GET /v1/kyc/data-export

### Folder: Webhooks (3 requests)
1. POST /v1/webhooks
2. GET /v1/webhooks
3. GET /v1/webhooks/:id/deliveries

### Folder: Admin (15 requests)
1. POST /v1/admin/users
2. POST /v1/admin/clients
3. GET /v1/admin/metrics
4. GET /v1/admin/system-config
5. PUT /v1/admin/system-config
6. GET /v1/admin/sandbox/accounts
7. GET /v1/admin/webhooks
8. GET /v1/admin/transactions/review
9. POST /v1/admin/staff/assign
10. GET /v1/admin/branches
11. POST /v1/admin/branches
12. GET /v1/admin/loans
13. GET /v1/admin/savings
14. GET /v1/admin/consents

### Folder: Communications (2 requests)
1. POST /v1/communications/send
2. POST /v1/communications/bulk

### Folder: Settlement (3 requests)
1. POST /v1/settlement/calculate
2. POST /v1/settlement/process
3. POST /v1/invoices/generate

### Folder: Institution (3 requests)
1. POST /v1/institutions/register
2. POST /v1/institutions/:id/clients
3. POST /v1/institutions/:id/kyb

### Folder: CrediQ (4 requests)
1. GET /v1/crediq/health-check
2. POST /v1/crediq/baseline-score
3. POST /v1/crediq/health-metrics
4. POST /v1/crediq/action-plan

### Folder: PostiQ (2 requests)
1. POST /v1/postiq/codes
2. GET /v1/postiq/codes/:code

### Folder: WooCommerce (3 requests)
1. POST /v1/woocommerce/merchants
2. POST /v1/woocommerce/validate-install
3. GET /v1/woocommerce/plugin/download

### Folder: Sandbox (4 requests)
1. POST /v1/sandbox/accounts
2. POST /v1/sandbox/api-keys
3. POST /v1/sandbox/data/generate
4. POST /v1/sandbox/webhooks

### Folder: Developer (1 request)
1. POST /v1/developers/register

### Folder: Payment Gateway (42 requests)
1. POST /v1/gateway/charges
2. GET /v1/gateway/charges/:id
3. GET /v1/gateway/charges
4. POST /v1/gateway/charges/:id/verify
5. POST /v1/gateway/charges/:id/cancel
6. GET /v1/gateway/fee-estimate
7. POST /v1/gateway/refunds
8. GET /v1/gateway/refunds/:id
9. GET /v1/gateway/refunds
10. POST /v1/gateway/payouts
11. GET /v1/gateway/payouts/:id
12. GET /v1/gateway/payouts
13. POST /v1/gateway/payout-batches
14. GET /v1/gateway/payout-batches/:id
15. GET /v1/gateway/disputes
16. GET /v1/gateway/disputes/:id
17. POST /v1/gateway/disputes/:id/evidence
18. GET /v1/gateway/settlements
19. GET /v1/gateway/settlements/:id
20. POST /v1/gateway/beneficiaries
21. GET /v1/gateway/beneficiaries
22. DELETE /v1/gateway/beneficiaries/:id
23. GET /v1/gateway/reports/transactions
24. GET /v1/gateway/reports/settlements
25. GET /v1/gateway/export/transactions
26. POST /v1/gateway/payment-links
27. GET /v1/gateway/payment-links
28. GET /v1/gateway/payment-links (list)
29. POST /v1/gateway/payment-plans
30. POST /v1/gateway/subscriptions
31. POST /v1/gateway/subscriptions/cancel
32. POST /v1/gateway/subaccounts
33. GET /v1/gateway/subaccounts
34. PATCH /v1/gateway/subaccounts/:id
35. POST /v1/gateway/customers
36. GET /v1/gateway/customers
37. GET /v1/gateway/customers/:id/tokens
38. POST /v1/gateway/virtual-accounts
39. GET /v1/gateway/virtual-accounts
40. POST /v1/gateway/verify-bank-account
41. POST /v1/gateway/resolve-bvn
42. GET /v1/gateway/exchange-rate

## TOTAL: ~165 Postman requests across 21 folders
