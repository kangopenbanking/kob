# KOB v1 — E2E Test Plan

> Generated: 2026-03-15 | Version: 6.0.0

## Journey 1: Developer → Sandbox → First API Call

### Steps
1. Register developer via `/auth` → "Build & Integrate"
2. Create developer app via `POST /v1/developers/register`
3. Obtain sandbox key/token via `POST /v1/sandbox/api-keys`
4. Call `GET /v1/health` (unauthenticated)
5. Call `GET /v1/aisp/accounts` (with sandbox token)
6. Register webhook endpoint via `POST /v1/sandbox/webhooks`

### Acceptance Criteria
- [ ] Developer profile created in `profiles` with developer role in `user_roles`
- [ ] Developer app recorded
- [ ] Sandbox API key issued and returned
- [ ] Health endpoint returns `{ status: "healthy" }`
- [ ] Authenticated call returns sandbox accounts
- [ ] Webhook endpoint registered and visible in developer portal
- [ ] Audit log entries exist for registration and key issuance
- [ ] Error responses match contract (error_id, error_code, message)

---

## Journey 2: Merchant → Onboard → Payment → Refund → Reporting

### Steps
1. Register merchant via `/auth` → "Accept Payments"
2. Submit KYB via `POST /v1/gateway/merchant-kyb`
3. Admin approves KYB via `gateway-merchant-kyb-review`
4. Merchant receives prod API keys
5. Create MoMo charge: `POST /v1/gateway/charges` with `{ provider: "flutterwave", payment_type: "mobile_money_cameroon", amount: 10000, currency: "XAF", phone: "237650000000" }`
6. Simulate Flutterwave webhook callback (charge successful)
7. Verify merchant webhook delivery log
8. Verify transaction appears in merchant dashboard
9. Create refund: `POST /v1/gateway/refunds` with `{ charge_id, amount: 5000 }`
10. Simulate Flutterwave refund webhook
11. Export transactions CSV: `GET /v1/gateway/export/transactions`

### Acceptance Criteria
- [ ] Merchant registered with `merchant` role
- [ ] KYB record created with `pending` status
- [ ] Admin approval updates status to `approved`; user notification sent
- [ ] Prod API keys available after approval
- [ ] Charge created with `pending` status, idempotency key stored
- [ ] Webhook ingestion: signature verified, event deduplicated via `webhook_inbox`
- [ ] `atomic_charge_wallet_credit` credits merchant wallet
- [ ] Merchant webhook delivered with HMAC-SHA256 signature
- [ ] Refund created, `atomic_refund_wallet_debit` debits wallet
- [ ] CSV export contains all transactions with correct statuses
- [ ] Ledger entries balanced (debits == credits)

---

## Journey 3: Institution → Onboard → AISP/PISP

### Steps
1. Register institution via `/auth` → "Open Banking APIs"
2. Submit KYB via `POST /v1/institutions/:id/kyb`
3. Admin approves via `admin-kyb-verify`
4. Create OAuth client via DCR: `POST /v1/dcr/register`
5. Obtain token: `POST /v1/oauth/token` (client_credentials)
6. Create AISP consent: `POST /v1/aisp/consents`
7. Authorize consent: `POST /v1/consents/:id/authorize`
8. Fetch accounts: `GET /v1/aisp/accounts`
9. Fetch balances: `GET /v1/aisp/accounts/:id/balances`
10. Fetch transactions: `GET /v1/aisp/accounts/:id/transactions`
11. Create PISP consent: `POST /v1/pisp/consents`
12. Submit domestic payment: `POST /v1/pisp/domestic-payment`
13. Check payment status: `GET /v1/pisp/payments/:id`

### Acceptance Criteria
- [ ] Institution registered with `institution` role
- [ ] KYB submitted and admin notified
- [ ] Admin approval triggers user notification
- [ ] OAuth client registered with `client_id` and `client_secret_hash`
- [ ] Access token issued with correct scopes
- [ ] AISP consent created with `AwaitingAuthorisation` status
- [ ] Authorization updates consent to `Authorised`
- [ ] Accounts returned filtered by authorized consent
- [ ] Balances returned with correct currency (XAF)
- [ ] Transactions paginated and filtered by date range
- [ ] PISP consent created
- [ ] Payment submitted with `pending` status
- [ ] Payment final status reflected (completed/failed)
- [ ] Consent events logged in `consent_events`
- [ ] All actions appear in admin review dashboard

---

## Journey 4: Failure Recovery & Idempotency

### Steps
1. Create a charge with an idempotency key
2. Retry the same charge with the same idempotency key
3. Simulate provider webhook delay (>5 minutes)
4. Verify `gateway-payout-status-poll` picks up stuck payment
5. Simulate provider failure webhook
6. Verify auto-reversal of wallet debit
7. Verify no duplicate ledger entries

### Acceptance Criteria
- [ ] Second charge request returns same response (idempotency)
- [ ] Stuck payment detected by poller within 5-minute window
- [ ] Poller updates status without duplicate processing
- [ ] Failed payout triggers `auto-reversal` with audit trail
- [ ] Wallet balance restored to pre-payout amount
- [ ] No duplicate entries in `webhook_inbox`
- [ ] No duplicate journal entries in ledger
- [ ] Notifications sent for failure events
- [ ] Error responses include `error_id` for tracing

---

## Test Execution

### Postman
Each journey has a corresponding Postman folder in the collection. Run via:
```bash
newman run kang-openbanking-api-v1.postman_collection.json \
  --folder "Journey 1 - Developer Sandbox" \
  --env-var "base_url=https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1"
```

### Automated
E2E tests located in `/tests/`:
- `developer-sandbox-e2e.test.ts`
- `merchant-payment-e2e.test.ts`
- `institution-aisp-pisp-e2e.test.ts`
- `failure-recovery-e2e.test.ts`

### CI
```bash
npm run test:e2e
```
