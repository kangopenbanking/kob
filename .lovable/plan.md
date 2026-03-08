

# KOB Payment Infrastructure — Deep Technical & Product Capability Audit

---

## CLASSIFICATION

**KOB is Category B: Wallet support with programmatic outbound payouts, but NO instant payout rails (no Visa Direct, Mastercard Send, or real-time bank push).**

---

## SECTION A — WALLET / STORED VALUE

### Current State: IMPLEMENTED (85%)

KOB has a functional custodial wallet system:

| Capability | Status | Implementation |
|---|---|---|
| User wallet accounts | Yes | `accounts` table + `account_balances` (ClosingAvailable/InterimAvailable) |
| Ledger-based balance tracking | Yes | `account_balances` with credit/debit indicators, datetime tracking |
| Programmatic credit | Yes | `funding-scope-creditor.ts` upserts balances; `gateway-fund-account` credits via charges |
| Programmatic debit | Yes | `gateway-process-withdrawal` debits balance atomically with rollback |
| Sub-accounts / Escrow | Partial | `gateway_merchant_wallets` (3-balance model: available/pending/ledger) per merchant per currency; no formal escrow API |
| Segregated fund structure | Not implemented | No dedicated safeguarding ledger or trust account segregation |
| Transaction history | Yes | `transactions` table with full metadata, per-account filtering |

### Missing: Dedicated Wallet REST API Surface

KOB has the underlying infrastructure but lacks a **formal `/v1/wallets/*` namespace**. Currently wallet operations are scattered across `gateway-fund-account`, `gateway-process-withdrawal`, and direct balance queries. Required new endpoints:

```text
POST   /v1/wallets                      — Create wallet (maps to account creation)
GET    /v1/wallets/{id}                  — Get wallet with balances
POST   /v1/wallets/{id}/credit           — Programmatic credit (wraps funding-scope-creditor)
POST   /v1/wallets/{id}/debit            — Programmatic debit (wraps withdrawal logic)
GET    /v1/wallets/{id}/transactions     — Transaction history for wallet
GET    /v1/wallets/{id}/statement        — Generate statement (wraps generate-bank-statement)
POST   /v1/wallets/{id}/freeze           — Freeze/unfreeze wallet (compliance)
```

**Required additions:**
- Idempotency-Key header support (already pattern exists in `gateway-fund-account`)
- Webhook events: `wallet.credited`, `wallet.debited`, `wallet.frozen`
- Escrow sub-wallet creation for marketplace holds

**Effort**: 1 new edge function (multi-method router), ~200 lines. No DB migration needed — uses existing `accounts` + `account_balances` tables.

---

## SECTION B — OUTBOUND PAYOUTS

### Current State: IMPLEMENTED (90%)

KOB has a comprehensive outbound payout system:

| Capability | Status | Provider |
|---|---|---|
| Payouts to bank accounts | Yes | Flutterwave `/v3/transfers` |
| Payouts to mobile money (MoMo) | Yes | Flutterwave MPS (MTN/Orange) |
| Payouts to debit cards | Partial | Stripe Refund-based (requires prior card deposit) |
| Payouts to PayPal | Yes | PayPal Batch Payouts API |
| Batch payouts | Yes | `gateway-create-payout-batch` (up to 15k items via PayPal) |
| Merchant-initiated payouts | Yes | `gateway-create-payout` (merchant wallet debit) |
| Consumer-initiated withdrawals | Yes | `gateway-process-withdrawal` (account balance debit) |
| Payout status polling | Yes | `gateway-payout-status-poll` |
| Async webhook updates | Yes | `gateway-payout-webhook` (Stripe/Flutterwave/PayPal) |
| Failed payout reversal | Yes | Automatic balance restoration on failure |
| Admin manual reversal | Yes | `gateway-admin-reverse-withdrawal` |
| Retry mechanism | Yes | `gateway-retry-payout` |
| Daily payout limits | Yes | Per-merchant `daily_payout_limit` enforcement |
| Idempotency | Yes | `idempotency-key` header on `gateway-create-payout` |

### Missing / Gaps

1. **True push-to-card payouts**: Current card withdrawal is a Stripe Refund against a prior PaymentIntent. This is NOT a true payout — it requires a prior deposit, has refund-window limitations (180 days), and doesn't support arbitrary card destinations. For true instant card payouts, KOB needs Visa Direct / Mastercard Send integration.

2. **Instant vs Standard payout parameter**: No `speed` parameter (`instant` | `standard`) on payout endpoints. All payouts use the provider's default speed.

3. **Formal `/v1/payouts/cancel` endpoint**: Cancellation is not exposed as a standalone API. Only failed payouts can be retried.

4. **Payout to arbitrary bank account** (non-linked): Currently requires a `linked_account_id` for consumer withdrawals. Merchant payouts accept direct beneficiary details but consumer withdrawals do not.

### Required Endpoint Additions

```text
POST   /v1/payouts/{id}/cancel          — Cancel pending payout before provider submission
PATCH  /v1/payouts                      — Add `speed: 'instant' | 'standard'` parameter
POST   /v1/payouts/card                 — True push-to-card (requires Visa Direct integration)
```

---

## SECTION C — INSTANT RAILS SUPPORT

### Current State: NOT IMPLEMENTED

| Rail | Status |
|---|---|
| Visa Direct | Not integrated |
| Mastercard Send | Not integrated |
| SEPA Instant / FPS / RTP | Not integrated |
| CEMAC real-time clearing (SYSTAC) | Not integrated |
| 24/7 settlement processing | No — relies on provider business hours |
| Push-to-card | Not available (Stripe refund ≠ push-to-card) |
| Prefunding / liquidity pool | Not implemented |

### Required Architecture for Instant Payouts

```text
┌─────────────────────────────────────────────┐
│            KOB Instant Payout Engine         │
├─────────────────────────────────────────────┤
│  1. Prefunding Pool (Float Management)       │
│     - Dedicated settlement account per rail  │
│     - Real-time float monitoring API         │
│     - Auto-replenishment triggers            │
├─────────────────────────────────────────────┤
│  2. Rail Router                              │
│     - Visa Direct (card payouts)             │
│     - Flutterwave Instant (MoMo already ~OK) │
│     - CEMAC RTGS / SYSTAC (bank-to-bank)    │
│     - Fallback: standard ACH-equivalent     │
├─────────────────────────────────────────────┤
│  3. Risk & Fraud Layer                       │
│     - Pre-payout risk scoring                │
│     - Velocity checks (existing)             │
│     - Amount limits per rail per user tier   │
│     - ML anomaly detection (ai-anomaly exists)│
├─────────────────────────────────────────────┤
│  4. Liquidity Management API                 │
│     GET  /v1/treasury/float-balance          │
│     POST /v1/treasury/replenish              │
│     GET  /v1/treasury/utilization            │
└─────────────────────────────────────────────┘
```

**Required new endpoints:**

```text
POST   /v1/payouts/instant              — Instant payout (auto-routes to fastest rail)
GET    /v1/payouts/rails                — List available rails + current speed + fees
POST   /v1/payouts/card/push            — Visa Direct push-to-card
GET    /v1/treasury/float               — Float balance per rail (admin)
POST   /v1/risk/pre-check               — Pre-payout risk assessment
```

**Estimated effort**: 3-5 new edge functions + Visa Direct API integration + prefunding account infrastructure. This is the largest gap.

---

## SECTION D — LICENSING & COMPLIANCE

### Current State: PARTIAL

| Capability | Status |
|---|---|
| KYC verification | Yes — `kyc-submit`, `kyc_verifications` table, document upload |
| KYB (merchant) | Yes — `gateway-merchant-kyb` (submit/review workflow) |
| AML sanctions screening | Yes — `sanctions-screen` edge function |
| Transaction monitoring | Yes — `transaction-monitor` + `ai-anomaly-detection` |
| CDD (Customer Due Diligence) | Yes — `customer_due_diligence` table, PEP checks, risk scoring |
| Risk scoring | Yes — `calculate_kyc_risk_score` DB function |
| Data retention | Yes — 7-year COBAC compliance policy |
| License type | Unclear — no EMI/MTL documentation found in codebase |

### Missing

1. **Formal EMI or Money Transmitter license documentation**: The platform operates as a wallet/payment processor but the licensing basis is not codified in the API. This is a business/legal gap, not a technical one.

2. **Real-time transaction screening for outbound payouts**: `transaction-monitor` exists but it's not inline (pre-payout). Payouts execute first, monitor after.

3. **Required compliance endpoints** (partially exist):

```text
POST   /v1/compliance/payout-screen     — Pre-payout AML/sanctions check (MISSING)
GET    /v1/compliance/user-risk/{id}     — User risk profile (exists via calculate_kyc_risk_score)
POST   /v1/compliance/sar               — Suspicious Activity Report submission (MISSING)
```

---

## SECTION E — TECHNICAL READINESS

### Current State: PRODUCTION-GRADE (85%)

| Feature | Status | Details |
|---|---|---|
| Idempotency-Key | Yes | Supported on charges, payouts, funding intents via header + DB dedup |
| Webhook system | Mature | HMAC-SHA256 signing, 7-retry exponential backoff, delivery logging, 24 event types |
| Rate limiting | Yes | DB-backed (`check_rate_limit` RPC), per-provider webhook limits, per-user API limits |
| Error format | Partial | Consistent `{error, message}` but NOT RFC 7807 `problem+json` everywhere |
| Sandbox simulation | Yes | `sandbox-*` functions for data generation, API key creation, webhook testing |
| API versioning | Yes | `/v1/` prefix on all endpoints |
| OpenAPI spec | Yes | `public-api-spec` (OpenAPI 3.1.0, 245+ endpoints documented) |
| Postman collection | Yes | `postman-collection` auto-generated |

### Missing

1. **RFC 7807 error responses** are not consistently used (some functions return `{error, message}`, not `{type, title, status, detail}`)
2. **SLA guarantees** are not programmatically documented (only operational: 15-min critical response)
3. **Payout sandbox simulation** — sandbox exists for charges but payout simulation with realistic delays is not confirmed

---

## COMPLETE GAP SUMMARY

### To compete with Stripe-style instant payouts, KOB needs:

| # | Gap | Priority | Effort |
|---|---|---|---|
| 1 | **Visa Direct integration** (true push-to-card) | CRITICAL | 1 edge function + Visa API onboarding |
| 2 | **Formal `/v1/wallets/*` REST namespace** | HIGH | 1 edge function (router) |
| 3 | **Instant payout rail router** with `speed` parameter | HIGH | 1 edge function + rail selection logic |
| 4 | **Prefunding / float management API** | HIGH | 1 edge function + treasury tables |
| 5 | **Pre-payout compliance screening** (inline) | HIGH | 1 edge function |
| 6 | **Payout cancellation endpoint** | MEDIUM | Add to existing payout function |
| 7 | **RFC 7807 error standardization** | MEDIUM | Update all edge functions |
| 8 | **Escrow / hold sub-wallets** | MEDIUM | 1 migration + 1 function |
| 9 | **Safeguarded fund segregation ledger** | MEDIUM | 1 migration |
| 10 | **SAR submission endpoint** | LOW | 1 edge function |

---

## FINAL ANSWERS

| Question | Answer |
|---|---|
| Can KOB support instant wallet-to-bank withdrawals? | **Partially** — Flutterwave MoMo is near-instant; bank transfers are T+1 to T+3. No real-time bank rail (RTGS/SYSTAC) integration. |
| Can KOB support instant wallet-to-card withdrawals? | **No** — Current implementation uses Stripe Refunds (requires prior deposit, 5-10 day processing). True push-to-card requires Visa Direct/Mastercard Send. |
| Can KOB support 24/7 real-time payout infrastructure? | **No** — Dependent on provider business hours. No prefunding pool, no instant rail router, no 24/7 settlement engine. |
| Production readiness for high-risk instant payout fintech? | **Not yet.** The wallet + standard payout infrastructure is solid (~90%), but instant rails, prefunding, and inline compliance screening are required before production deployment for an instant payout platform. |

### Recommended Upgrade Roadmap

```text
Phase 1 (4-6 weeks): Wallet API namespace + inline compliance screening + payout cancel
Phase 2 (6-10 weeks): Visa Direct integration + instant rail router + speed parameter
Phase 3 (4-6 weeks): Prefunding/treasury API + float monitoring + 24/7 settlement cron
Phase 4 (2-4 weeks): Escrow sub-wallets + safeguarding ledger + SAR endpoint
```

