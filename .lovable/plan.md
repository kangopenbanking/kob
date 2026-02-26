

## Full E2E API Audit — Gap Analysis & Fix Plan

### Audit Methodology
Cross-referenced 3 sources: (1) 160+ edge functions in `supabase/functions/`, (2) OpenAPI spec in `public-api-spec/index.ts` (1524 lines, ~85 paths), (3) Postman collection in `postman-collection/index.ts` (867 lines, ~140 requests), and (4) Developer portal pages (55 pages).

---

### Critical Gaps Found

#### GAP 1: 17 Gateway Endpoints Missing from OpenAPI Spec

The Postman collection and edge functions include these endpoints, but the OpenAPI spec (`public-api-spec/index.ts`) does NOT define them:

| # | Endpoint | Edge Function | In Postman | In OpenAPI |
|---|----------|--------------|------------|------------|
| 1 | `POST /v1/gateway/payment-links` | gateway-create-payment-link | Yes | **NO** |
| 2 | `GET /v1/gateway/payment-links` | gateway-get-payment-link | Yes | **NO** |
| 3 | `PUT /v1/gateway/payment-links/{id}` | gateway-update-payment-link | Yes | **NO** |
| 4 | `DELETE /v1/gateway/payment-links/{id}` | gateway-delete-payment-link | Yes | **NO** |
| 5 | `POST /v1/gateway/payment-plans` | gateway-create-payment-plan | Yes | **NO** |
| 6 | `GET /v1/gateway/payment-plans/{id}` | gateway-get-payment-plan | Yes | **NO** |
| 7 | `PUT /v1/gateway/payment-plans/{id}` | gateway-update-payment-plan | Yes | **NO** |
| 8 | `POST /v1/gateway/subscriptions` | gateway-create-subscription | Yes | **NO** |
| 9 | `GET /v1/gateway/subscriptions/{id}` | gateway-get-subscription | Yes | **NO** |
| 10 | `POST /v1/gateway/subscriptions/cancel` | gateway-cancel-subscription | Yes | **NO** |
| 11 | `POST /v1/gateway/subaccounts` | gateway-create-subaccount | Yes | **NO** |
| 12 | `GET /v1/gateway/subaccounts/{id}` | gateway-get-subaccount | Yes | **NO** |
| 13 | `PUT /v1/gateway/subaccounts/{id}` | gateway-update-subaccount | Yes | **NO** |
| 14 | `DELETE /v1/gateway/subaccounts/{id}` | gateway-delete-subaccount | Yes | **NO** |
| 15 | `POST /v1/gateway/customers` | gateway-create-customer | Yes | **NO** |
| 16 | `GET /v1/gateway/customers` | gateway-list-customers | Yes | **NO** |
| 17 | `GET /v1/gateway/customers/{id}` | gateway-get-customer | Yes | **NO** |
| 18 | `PUT /v1/gateway/customers/{id}` | gateway-update-customer | Yes | **NO** |
| 19 | `GET /v1/gateway/customers/{id}/tokens` | gateway-list-customer-tokens | Yes | **NO** |
| 20 | `DELETE /v1/gateway/customers/{id}/tokens/{tokenId}` | gateway-revoke-customer-token | Yes | **NO** |
| 21 | `POST /v1/gateway/charges/token` | gateway-charge-token | Yes | **NO** |
| 22 | `GET /v1/gateway/charges/{id}/events` | gateway-get-charge-events | Yes | **NO** |
| 23 | `POST /v1/gateway/reconciliation` | gateway-reconciliation | Yes | **NO** |
| 24 | `GET /v1/gateway/reconciliation` | gateway-reconciliation | Yes | **NO** |
| 25 | `GET /v1/gateway/reports/fees` | gateway-report-fees | Yes | **NO** |
| 26 | `POST /v1/gateway/payouts/{id}/retry` | gateway-retry-payout | Yes | **NO** |

#### GAP 2: Merchant Onboarding Endpoints Missing from OpenAPI Spec

The Postman collection has a full "Merchants" section with 17 requests. None are in the OpenAPI spec:

| # | Endpoint | Edge Function |
|---|----------|--------------|
| 1 | `POST /v1/merchants` (create) | gateway-merchant-lifecycle |
| 2 | `GET /v1/merchants` (get/list) | gateway-merchant-lifecycle |
| 3 | `PATCH /v1/merchants` (update) | gateway-merchant-lifecycle |
| 4 | `POST /v1/merchants` (submit/activate/suspend) | gateway-merchant-lifecycle |
| 5 | `POST /v1/merchants/kyb` | gateway-merchant-kyb |
| 6 | `GET /v1/merchants/kyb` | gateway-merchant-kyb |
| 7 | `POST /v1/merchants/api-keys` | gateway-merchant-keys |
| 8 | `GET /v1/merchants/api-keys` | gateway-merchant-keys |
| 9 | `DELETE /v1/merchants/api-keys` | gateway-merchant-keys |
| 10 | `POST /v1/merchants/settlement-accounts` | gateway-merchant-settlement-accounts |
| 11 | `GET /v1/merchants/settlement-accounts` | gateway-merchant-settlement-accounts |
| 12 | `POST /v1/merchants/webhooks` | gateway-merchant-webhooks |
| 13 | `GET /v1/merchants/webhooks` | gateway-merchant-webhooks |

#### GAP 3: Fee Estimate Channel Enum Out of Date

The OpenAPI spec at line 1237 has `enum: ['mobile_money', 'card', 'bank_transfer']` for the fee-estimate channel parameter, but the actual `calculateGatewayFee()` supports 8 channels: `mobile_money`, `card`, `bank_transfer`, `apple_pay`, `google_pay`, `ussd`, `account_funding`, `paypal`.

#### GAP 4: Charge Channel Enum Incomplete

The `POST /v1/gateway/charges` at line 1220 has `channel: { enum: ['mobile_money', 'card', 'bank_transfer'] }` but the `GatewayCharge` schema (line 249) correctly lists all 7 channels including `apple_pay`, `google_pay`, `ussd`, `paypal`. The endpoint request schema is inconsistent.

#### GAP 5: Missing Payment Facilitation Tag in Tags List

The `Payment Facilitation` tag is used in paths (lines 1377-1389) but is NOT listed in the tags array (lines 1429-1458).

#### GAP 6: Duplicate Settlement Paths

Lines 1141-1147 define `/v1/settlement/calculate` and `/v1/settlement/process` under the `Settlement` tag. Lines 1382-1389 redefine the same paths under the `Payment Facilitation` tag. The second definition overwrites the first. This is technically working but the Settlement tag entries are dead code.

#### GAP 7: Developer Portal "Payment Facilitation" Duplicated in Sidebar

In `DeveloperLayout.tsx`, "Payment Facilitation" appears in both "Open Banking APIs" (line 88) and "Integration Guides" (line 114). This is confusing.

---

### Implementation Plan

#### Phase 1: Add 39 Missing OpenAPI Paths (~biggest gap)

**File: `supabase/functions/public-api-spec/index.ts`**

Add the following path blocks after the existing Payment Gateway section:

**Payment Links (4 paths):**
- `POST /v1/gateway/payment-links` — Create payment link
- `GET /v1/gateway/payment-links` — List/get payment links (by slug or merchant_id)
- `PUT /v1/gateway/payment-links/{linkId}` — Update payment link
- `DELETE /v1/gateway/payment-links/{linkId}` — Delete payment link

**Payment Plans (4 paths):**
- `POST /v1/gateway/payment-plans` — Create payment plan
- `GET /v1/gateway/payment-plans` — List payment plans
- `GET /v1/gateway/payment-plans/{planId}` — Get payment plan
- `PUT /v1/gateway/payment-plans/{planId}` — Update payment plan

**Subscriptions (4 paths):**
- `POST /v1/gateway/subscriptions` — Create subscription
- `GET /v1/gateway/subscriptions` — List subscriptions
- `GET /v1/gateway/subscriptions/{subscriptionId}` — Get subscription
- `POST /v1/gateway/subscriptions/cancel` — Cancel subscription

**Subaccounts / Split Payments (4 paths):**
- `POST /v1/gateway/subaccounts` — Create subaccount
- `GET /v1/gateway/subaccounts` — List subaccounts
- `GET /v1/gateway/subaccounts/{subaccountId}` — Get subaccount
- `PUT /v1/gateway/subaccounts/{subaccountId}` — Update subaccount
- `DELETE /v1/gateway/subaccounts/{subaccountId}` — Delete subaccount

**Customers & Tokenization (7 paths):**
- `POST /v1/gateway/customers` — Create customer
- `GET /v1/gateway/customers` — List customers
- `GET /v1/gateway/customers/{customerId}` — Get customer
- `PUT /v1/gateway/customers/{customerId}` — Update customer
- `GET /v1/gateway/customers/{customerId}/tokens` — List customer tokens
- `DELETE /v1/gateway/customers/{customerId}/tokens/{tokenId}` — Revoke token
- `POST /v1/gateway/charges/token` — Charge a saved token

**Charge Events (1 path):**
- `GET /v1/gateway/charges/{chargeId}/events` — Get charge event timeline

**Reconciliation (2 paths):**
- `POST /v1/gateway/reconciliation` — Run reconciliation
- `GET /v1/gateway/reconciliation` — List runs / get mismatches

**Reports (1 path):**
- `GET /v1/gateway/reports/fees` — Fee report

**Retry (1 path):**
- `POST /v1/gateway/payouts/{payoutId}/retry` — Retry failed payout

**Merchants (6 paths):**
- `POST /v1/merchants` — Create/manage merchant (lifecycle actions)
- `GET /v1/merchants` — List/get merchants
- `PATCH /v1/merchants` — Update merchant
- `POST /v1/merchants/kyb` — Submit/review KYB
- `GET /v1/merchants/kyb` — Get KYB status
- `POST /v1/merchants/api-keys` — Issue/list/revoke API keys
- `POST /v1/merchants/settlement-accounts` — Add settlement account
- `GET /v1/merchants/settlement-accounts` — List settlement accounts
- `POST /v1/merchants/webhooks` — Register/manage merchant webhooks
- `GET /v1/merchants/webhooks` — List webhooks

Add new schemas: `GatewayPaymentLink`, `GatewayPaymentPlan`, `GatewaySubscription`, `GatewaySubaccount`, `GatewayCustomer`, `GatewayCustomerToken`, `GatewayChargeEvent`, `GatewayReconciliationRun`, `GatewayMerchant`.

Add new tags: `Payment Facilitation`, `Merchant Onboarding`.

#### Phase 2: Fix Enum Inconsistencies

**File: `supabase/functions/public-api-spec/index.ts`**

1. Update fee-estimate channel enum (line 1237) to include all 8 channels
2. Update `POST /v1/gateway/charges` channel enum (line 1220) to match the schema (7 channels)
3. Remove duplicate Settlement paths (lines 1141-1151) — the Payment Facilitation versions (lines 1382-1389) are more detailed

#### Phase 3: Fix Developer Portal Sidebar Duplicate

**File: `src/components/developer/DeveloperLayout.tsx`**

Remove the duplicate "Payment Facilitation" entry from the "Integration Guides" section (line 114), keeping only the one in "Open Banking APIs" (line 88).

#### Phase 4: Update Changelog

**File: `src/pages/developer/Changelog.tsx`**

Add v2.6.0 entry:
- OpenAPI spec expanded with 39 missing endpoint paths (Payment Links, Subscriptions, Split Payments, Tokenization, Charge Events, Reconciliation, Merchant Onboarding)
- 9 new schemas added (GatewayPaymentLink, GatewayPaymentPlan, GatewaySubscription, etc.)
- Fee estimate and charge channel enums updated to support all 8 channels
- Payment Facilitation and Merchant Onboarding tags added to spec
- Duplicate Settlement path definitions resolved
- Developer portal sidebar de-duplicated

#### Phase 5: Update Tests

**File: `src/test/gateway-integration.test.ts`**

Add tests:
- Verify all 8 fee channels produce correct calculations
- Verify GatewayCharge schema has 7 channel types
- Verify transfer channels count remains at 7
- Add payment links, subscriptions, reconciliation endpoint path validation

---

### Files to Modify (4)

| File | Changes |
|---|---|
| `supabase/functions/public-api-spec/index.ts` | Add 39 endpoint paths, 9 schemas, 2 tags, fix 2 enum inconsistencies, remove duplicate Settlement paths |
| `src/components/developer/DeveloperLayout.tsx` | Remove duplicate sidebar entry |
| `src/pages/developer/Changelog.tsx` | Add v2.6.0 release |
| `src/test/gateway-integration.test.ts` | Expand test coverage |

### No Files to Create

All edge functions and developer pages already exist. This is purely an OpenAPI spec alignment and documentation synchronization task.

### Non-Breaking Guarantee

All changes are additive spec documentation updates. No edge function logic, database schema, or frontend routing changes are needed.

