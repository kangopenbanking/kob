

## Core Gateway Capabilities — E2E Audit & Gap Analysis

### Audit Results: Feature-by-Feature Verification

| Feature | Edge Functions | OpenAPI Spec | Postman | Dev Portal Page | Status |
|---------|--------------|-------------|---------|----------------|--------|
| Card Processing (charge, 3DS) | `gateway-create-charge` (card→Stripe, requires_action for 3DS) | `/v1/gateway/charges` | Yes | `GatewayChargesGuide` | COMPLETE |
| Tokenization | `gateway-create-customer`, `gateway-charge-token`, `gateway-list-customer-tokens`, `gateway-revoke-customer-token` | `/v1/gateway/customers`, `/v1/gateway/charges/token` | Yes | `GatewayTokenizationGuide` | COMPLETE |
| Mobile Money | `gateway-create-charge` (mobile_money→Flutterwave), webhooks | `/v1/gateway/charges` | Yes | `GatewayChargesGuide` | COMPLETE |
| Refund & Chargeback | `gateway-create-refund`, `gateway-get-refund`, `gateway-list-refunds` | `/v1/gateway/refunds` | Yes | `GatewayRefundsGuide` | COMPLETE |
| Hosted Checkout | `gateway-create-payment-link`, `/pay/:slug` route | `/v1/gateway/payment-links` | Yes | `GatewayPaymentLinksGuide` | COMPLETE |
| Payouts/Disbursements | `gateway-create-payout`, `gateway-create-payout-batch`, `gateway-retry-payout`, `gateway-fund-account`, `gateway-withdraw-to-bank` | All present | Yes | `GatewayPayoutsGuide`, `GatewayFundingGuide` | COMPLETE |
| Webhook Subscriptions | `gateway-merchant-webhooks`, `gateway-deliver-webhook`, 24 event types | `/v1/gateway/webhooks` | Yes | `GatewayWebhooksGuide` | COMPLETE |
| Recurring Billing | `gateway-create-payment-plan`, `gateway-create-subscription`, `gateway-cancel-subscription`, `gateway-subscription-charge-cron` | `/v1/gateway/payment-plans`, `/v1/gateway/subscriptions` | Yes | `GatewaySubscriptionsGuide` | COMPLETE |
| Risk & Fraud | `transaction-monitor` (velocity, amount threshold, pattern anomaly) | **MISSING** | **MISSING** | `RiskAuditReference` (limits/audit only) | **GAP** |
| Multi-currency/FX | `gateway-get-exchange-rate` (Frankfurter API), settlement_currency in charges | **MISSING** from gateway tag | Postman has it | `GatewayChargesGuide` mentions it | **GAP** |
| SDKs & Libraries | N/A (documentation only) | N/A | N/A | `SDKsPage` (8 SDKs) | COMPLETE |
| Fee Estimate | `gateway-fee-estimate` | Present | Present | `GatewayChargesGuide` | COMPLETE |
| Invoice Generation | `generate-invoice` (admin-only) | **MISSING** | Present | **MISSING** from subscriptions guide | **GAP** |

### Identified Gaps (3 items)

#### Gap 1: Risk & Fraud API not in OpenAPI spec or Postman collection
- `transaction-monitor` edge function exists and works (velocity checks, amount thresholds, pattern anomalies)
- `RiskAuditReference.tsx` documents limits and audit trail but not the transaction scoring endpoint
- Missing from OpenAPI spec: `/v1/risk/score-transaction`
- Missing from Postman collection: "Score Transaction" request

**Fix**: Add `/v1/gateway/risk/score` to OpenAPI spec and Postman collection. Update `RiskAuditReference.tsx` with the scoring endpoint documentation.

#### Gap 2: Gateway Exchange Rate not in OpenAPI spec under Payment Gateway tag
- `gateway-get-exchange-rate` edge function exists and works
- Only documented under Banking Operations as `/v1/banking/exchange-rate`
- Missing as `/v1/gateway/exchange-rate` in the Payment Gateway tag for gateway-specific FX lookups

**Fix**: Add `/v1/gateway/exchange-rate` to OpenAPI spec under Payment Gateway tag. Already in Postman.

#### Gap 3: Invoice generation not documented in Subscriptions guide
- `generate-invoice` edge function exists (admin-only)
- Not referenced in `GatewaySubscriptionsGuide.tsx`
- Developers integrating recurring billing need to know invoices are auto-generated

**Fix**: Add a note/section to `GatewaySubscriptionsGuide.tsx` about invoice generation for subscription billing cycles.

### Implementation Plan

**Stage 1**: Add `/v1/gateway/risk/score` and `/v1/gateway/exchange-rate` to the OpenAPI spec (`public-api-spec/index.ts`)

**Stage 2**: Add "Score Transaction" and "Gateway Exchange Rate" to Postman collection (`postman-collection/index.ts`)

**Stage 3**: Update `RiskAuditReference.tsx` — add Transaction Risk Scoring endpoint documentation with request/response schema

**Stage 4**: Update `GatewaySubscriptionsGuide.tsx` — add invoice generation note

**Stage 5**: Update `gateway-fee-estimate` fee_breakdown to include `account_funding` and `ussd` channels

**Stage 6**: Update Changelog to v2.3.0

**Stage 7**: Expand `src/test/gateway-integration.test.ts` with tests for USSD/Apple Pay/Google Pay fee calculations, and new OpenAPI endpoint coverage validation

**Stage 8**: Run final E2E tests

### Files to modify:
- `supabase/functions/public-api-spec/index.ts` — add 2 new paths
- `supabase/functions/postman-collection/index.ts` — add 2 new requests
- `supabase/functions/gateway-fee-estimate/index.ts` — update fee_breakdown for all channels
- `src/pages/developer/RiskAuditReference.tsx` — add scoring endpoint
- `src/pages/developer/GatewaySubscriptionsGuide.tsx` — add invoice note
- `src/pages/developer/Changelog.tsx` — add v2.3.0 entry
- `src/test/gateway-integration.test.ts` — expand test coverage

### Non-Breaking Guarantee
All changes are additive. No existing endpoints, routes, or data structures are modified. Only documentation synchronization and test expansion.

