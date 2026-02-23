# Gap Report — Payment Gateway Enhancement Audit
> Generated: 2026-02-23 | Phase 0

## Executive Summary

The KOB platform is **~85% complete** as a full payment gateway comparable to Flutterwave. The core transaction engine (charges, payouts, refunds, disputes, settlements) is fully operational with provider adapters, webhook ingestion, and outbound delivery. The remaining gaps are concentrated in **merchant lifecycle management** and **formal reconciliation infrastructure**.

---

## ✅ ALREADY IMPLEMENTED (No Action Needed)

### Gateway Core — COMPLETE
- [x] Charges (create, get, list, verify, cancel, preauth, capture, void, token charge)
- [x] Payouts (create, get, list, retry, batch)
- [x] Refunds (create, get, list)
- [x] Disputes (get, list, submit evidence)
- [x] Settlements (get, list, report)
- [x] Beneficiaries (create, list, delete)
- [x] Fee estimation
- [x] Transaction export (CSV)
- [x] Transaction & settlement reports

### Provider Adapters — COMPLETE
- [x] Flutterwave adapter (charges, payouts)
- [x] Stripe adapter (charges, refunds)
- [x] Status mapping (both providers)
- [x] Fee calculation engine

### Provider Webhook Ingestion — COMPLETE
- [x] `gateway-webhook-flutterwave`: signature verification, deduplication via `webhook_inbox`, canonical status mapping, outbound webhook triggering
- [x] `gateway-webhook-stripe`: Stripe signature verification, deduplication, dispute/refund/payment_intent handling, outbound webhook triggering
- [x] Virtual account credit handling (Flutterwave)

### Outbound Merchant Webhooks — COMPLETE
- [x] `gateway-deliver-webhook`: HMAC-SHA256 signing, exponential backoff (7 retries), delivery logging
- [x] `gateway_webhook_events` table with status tracking
- [x] Event types: charge.successful, charge.failed, payout.completed, payout.failed, dispute.created, virtualaccount.credit

### Merchant Infrastructure — PARTIAL
- [x] `gateway_merchants` table (business_name, status, kyb_status, webhook_url/secret, fee_bearer, risk limits)
- [x] `gateway_merchant_api_keys` table + CRUD (create, list, revoke)
- [x] `gateway_merchant_wallets` (available/pending/ledger balances, multi-currency)
- [x] `update_merchant_wallet` database function

### Advanced Features — COMPLETE
- [x] Payment links (CRUD)
- [x] Subscription plans + recurring charge cron
- [x] Sub-accounts (split payments)
- [x] Customer profiles + payment tokenization
- [x] Virtual accounts
- [x] Charge event timeline (`gateway_charge_events`)
- [x] FX rate quotes

### Reconciliation — PARTIAL
- [x] `gateway-reconcile-stuck`: polls providers for stuck transactions (>30 min), auto-fails >24h
- [x] Handles charges, payouts, refunds

---

## ❌ GAPS — Implementation Required

### GAP 1: Merchant CRUD & Lifecycle Endpoints (Priority: HIGH)
**Current state**: Merchants exist in DB but no dedicated REST API for lifecycle management.
**Missing endpoints**:
| Endpoint | Description |
|---|---|
| POST /v1/merchants | Create merchant (DRAFT) |
| GET /v1/merchants/:id | Get merchant details |
| PATCH /v1/merchants/:id | Update merchant |
| POST /v1/merchants/:id/submit | DRAFT → SUBMITTED |
| POST /v1/merchants/:id/activate | VERIFIED → ACTIVE (admin) |
| POST /v1/merchants/:id/suspend | Suspend merchant (admin) |
| POST /v1/merchants/:id/close | Close merchant (admin) |

**Estimated effort**: 1 edge function (multi-method router)

### GAP 2: Merchant KYB Review Endpoints (Priority: HIGH)
**Current state**: `kyb_status` field exists on merchants but no dedicated KYB submission/review API.
**Missing endpoints**:
| Endpoint | Description |
|---|---|
| POST /v1/merchants/:id/kyb/submit | Submit KYB documents |
| GET /v1/merchants/:id/kyb/status | Get KYB review status |
| POST /v1/merchants/:id/kyb/review | Admin approve/reject |

**Estimated effort**: 1 edge function

### GAP 3: Merchant Settlement Account Config (Priority: MEDIUM)
**Current state**: Merchants have wallet balances but no configurable settlement account destinations.
**Missing**:
- `gateway_merchant_settlement_accounts` table
- CRUD endpoints for settlement account management

**Estimated effort**: 1 migration + 1 edge function

### GAP 4: Per-Merchant Multiple Webhook Endpoints (Priority: MEDIUM)
**Current state**: Single `webhook_url` + `webhook_secret` on `gateway_merchants` table. Works for basic scenarios.
**Gap**: No support for multiple webhook endpoints per merchant with event filtering.
**Missing**:
- `gateway_merchant_webhooks` table (multiple endpoints per merchant)
- CRUD endpoints
- Delivery logs per webhook endpoint
- Test ping endpoint

**Estimated effort**: 1 migration + 1 edge function + update `gateway-deliver-webhook`

### GAP 5: Formal Reconciliation Framework (Priority: MEDIUM)
**Current state**: `gateway-reconcile-stuck` handles stuck transactions but no formal reconciliation runs/mismatch tracking.
**Missing**:
- `reconciliation_runs` table
- `reconciliation_mismatches` table
- Endpoints: run, list, get, resolve mismatches

**Estimated effort**: 1 migration + 1 edge function

### GAP 6: Fee Reporting Endpoint (Priority: LOW)
**Missing**: GET /v1/gateway/reports/fees (per-merchant fee breakdown by period)
**Estimated effort**: 1 edge function

### GAP 7: API Key Rotation Endpoint (Priority: LOW)
**Current state**: Can create and revoke keys. No atomic rotate (create new + revoke old).
**Missing**: POST /v1/merchants/:id/api-keys/:keyId/rotate
**Estimated effort**: Add to existing gateway-merchant-keys function

### GAP 8: Nigeria-Specific Endpoint Flagging (Priority: LOW)
**Current state**: `gateway-resolve-bvn` is Nigeria-specific but not flagged.
**Action**: Add deprecation/country flag notices in OpenAPI spec. No code change needed.

---

## 📊 Gap Summary

| Gap | Priority | Effort | DB Migration |
|---|---|---|---|
| Merchant CRUD & Lifecycle | HIGH | 1 function | No |
| Merchant KYB Review | HIGH | 1 function | No |
| Settlement Account Config | MEDIUM | 1 function | Yes |
| Per-Merchant Webhooks | MEDIUM | 1 function + update | Yes |
| Reconciliation Framework | MEDIUM | 1 function | Yes |
| Fee Reporting | LOW | 1 function | No |
| API Key Rotation | LOW | Update existing | No |
| Nigeria Flagging | LOW | Docs only | No |

**Total new edge functions**: 5
**Total DB migrations**: 3
**Existing functions to update**: 2
