

# KOB v1 Full Inter-Banking Gap Audit
**Scope:** Banks (API-less) · Merchants/Businesses · Developers · Consumer App · Banking PWA · Business App

---

## 1. Executive Summary

The KOB platform is **85-90% production-ready** as a full inter-banking ecosystem. There are **12 actionable gaps** across 4 severity levels that prevent it from being a complete, end-to-end interbank platform where all stakeholder types can fully operate.

---

## 2. Gap Matrix

| # | Gap | Severity | Stakeholder | Area |
|---|-----|----------|-------------|------|
| 1 | DB Connector has no production sync engine | **CRITICAL** | Banks | Bank Connector |
| 2 | MFA OTP delivery is a `console.log` stub | **CRITICAL** | All | Security |
| 3 | Kafka/RabbitMQ adapters use HTTP proxies only — no native drivers | **HIGH** | Banks | MQ Connector |
| 4 | No `connector_pull` implementation (KOB → Bank REST API) | **HIGH** | Banks | Bank Connector |
| 5 | Interbank outbox cron not scheduled | **HIGH** | Banks | Interbank |
| 6 | No bank self-service onboarding flow in FI Portal | **HIGH** | Banks | FI Portal |
| 7 | SDKs are documentation-only (no published packages) | **MEDIUM** | Developers | Developer Portal |
| 8 | Virtual cards service degraded | **MEDIUM** | Consumers | Consumer App |
| 9 | No webhook retry dashboard for merchants | **MEDIUM** | Merchants | Business App |
| 10 | No merchant dispute response UI in Business App | **MEDIUM** | Merchants | Business App |
| 11 | Business App missing invoice/billing module | **LOW** | Merchants | Business App |
| 12 | No automated E2E contract test runner (CI) | **LOW** | Developers | DevOps |

---

## 3. Detailed Gap Analysis

### GAP 1: DB Connector — Production Sync Not Implemented (CRITICAL)

**File:** `supabase/functions/bank-db-connector/index.ts` lines 335-342

The `executeSync()` function returns `not_implemented` for production mode. Sandbox generates mock data, but real DB polling (PostgreSQL, MySQL, Oracle) has no driver. The `test_connection` action (line 144) is also simulated — it validates config shape but never opens a TCP socket.

**Impact:** Banks that want DB-to-DB integration cannot use this in production.

**Fix:** Build a proxy-based DB adapter that routes queries through a secure relay service (since Deno Edge Functions cannot natively connect to external databases via TCP). This requires an intermediary microservice or a Deno-compatible HTTP-to-SQL bridge.

---

### GAP 2: MFA OTP Delivery is a Console.log Stub (CRITICAL)

**Files:**
- `supabase/functions/identity-mfa/index.ts` line 186: `// TODO: Actually send the code via SMS/email`
- `supabase/functions/identity-login/index.ts` line 136: `// TODO: Send OTP via SMS/email`

MFA challenge codes are generated and stored but never delivered to the user. They are only logged to console.

**Impact:** MFA is non-functional for all users. Security-critical for banking.

**Fix:** Wire MFA delivery through the existing `phone-auth-send-otp` (for SMS/WhatsApp) and `managed-send-email` (for email) edge functions.

---

### GAP 3: Kafka/RabbitMQ — HTTP Proxy Only (HIGH)

The Kafka adapter uses Confluent REST Proxy and RabbitMQ uses Management HTTP API. These are fine for low-throughput scenarios but:
- No consumer group management lifecycle
- No persistent subscriptions (must poll)
- No dead-letter queue handling
- No schema registry integration

**Impact:** Not suitable for high-throughput production interbank messaging (1000+ msg/sec).

**Fix:** This is an architectural limitation of Edge Functions (no persistent TCP connections). Document this limitation and recommend banks deploy a sidecar agent for high-throughput scenarios, or build a KOB Bridge Service that maintains persistent broker connections.

---

### GAP 4: No `connector_pull` Mode (KOB → Bank REST API) (HIGH)

The OpenAPI spec lists `connector_pull` as a valid `integration_mode`, but there is no edge function that calls external bank REST APIs. All data flow is bank-push (ingestion endpoints) or file-based.

**Impact:** Banks that already have REST APIs cannot be auto-polled by KOB.

**Fix:** Create a `bank-api-connector` edge function that:
- Stores bank API endpoint configs (base URL, auth method, paths)
- Implements OAuth2/API-key auth to external banks
- Polls configured endpoints on schedule
- Normalizes responses into `bank_sourced_*` tables

---

### GAP 5: Interbank Outbox Cron Not Scheduled (HIGH)

`interbank-dispatch-worker` exists and works but is not scheduled. The audit report notes: "Configure interbank-outbox-cron for automated dispatch" as a TODO.

**Impact:** Interbank payments sit in the outbox until manually triggered.

**Fix:** Add cron schedule configuration in `supabase/config.toml` or document the external cron setup needed.

---

### GAP 6: No Bank Self-Service Onboarding in FI Portal (HIGH)

The FI Portal has the Connector Kit for file operations, but there is no guided onboarding wizard for a bank to:
1. Register in the bank directory
2. Choose integration mode (file/DB/MQ/API)
3. Upload mTLS certificate
4. Configure connector settings
5. Run sandbox validation

Currently, bank registration requires admin action via `bank-directory` edge function.

**Impact:** Banks cannot self-onboard; requires admin intervention for every new bank.

**Fix:** Build a multi-step onboarding wizard in the FI Portal (`/fi-portal/connector/onboard`) that calls `bank-directory` actions with the institution's scoped context.

---

### GAP 7: SDKs Are Documentation-Only (MEDIUM)

The SDKs page (`SDKsPage.tsx`) lists `npm install @kob/sdk`, `pip install kob-sdk`, etc., but no actual packages are published. These are aspirational references.

**Impact:** Developers cannot install SDKs; must use raw HTTP/fetch.

**Fix:** Either build and publish actual SDK packages, or clearly label them as "Coming Soon" and provide comprehensive cURL/fetch examples for all endpoints (already partially done via API Playground).

---

### GAP 8: Virtual Cards Service Degraded (MEDIUM)

The `api-health` endpoint reports `virtual_cards` as degraded. The function uses placeholder KYC data (line 117: `id_front_image: 'placeholder-id.png'`).

**Impact:** Virtual card issuance may fail for real users.

**Fix:** Wire real KYC document URLs from `kyc_verifications` table into the virtual card creation payload.

---

### GAP 9 & 10: Business App Missing Webhook Retry + Dispute Response (MEDIUM)

The Business App (`/biz/*`) has 25+ pages covering POS, products, analytics, staff, travel, etc. But:
- No webhook delivery log viewer (merchants can't see failed deliveries)
- No dispute evidence submission UI (exists as `gateway-submit-dispute-evidence` edge function but no Business App page)

**Fix:** Add `/biz/webhook-logs` and `/biz/disputes` pages wiring to existing edge functions.

---

### GAP 11: No Invoice/Billing Module in Business App (LOW)

Admin has `admin-invoice-actions` and `generate-invoice`, but Business App has no self-service invoice creation for merchants to bill their customers.

**Fix:** Add `/biz/invoices` page using `generate-invoice` and `send-customer-invoice` edge functions.

---

### GAP 12: No Automated E2E Contract Test Runner (LOW)

`payment-tests/index.test.ts` exists with 16+ scenarios, but there's no CI pipeline or scheduled execution.

**Fix:** Document how to run `supabase--test_edge_functions` and add a `load-test-runner` schedule.

---

## 4. What's Working Well (No Gaps)

| Area | Status | Notes |
|------|--------|-------|
| AISP (Account Info) | ✅ Complete | 7 endpoints, bank-sourced fallback |
| PISP (Payments) | ✅ Complete | Idempotent, double-entry ledger |
| Payment Gateway | ✅ Complete | 80+ functions, 4 providers |
| OAuth2/FAPI | ✅ Complete | DCR, PAR, PKCE, mTLS |
| File Connector (CSV/SFTP) | ✅ Complete | SHA-256 dedup, pain.001 |
| Consumer App (/app) | ✅ Complete | 25+ routes, full wallet lifecycle |
| Banking PWA (/bank/:id) | ✅ Complete | 20+ routes, multi-tenant |
| Business App (/biz) | ✅ 90% | 25 pages, minor gaps above |
| Developer Portal | ✅ 95% | Playground, sandbox, docs |
| Admin Portal | ✅ Complete | 50+ modules |
| Interbank Engine | ✅ 90% | ISO 20022, 10-state machine |
| Webhook Governance | ✅ Complete | HMAC-SHA256, 7-retry backoff |
| Audit Logging | ✅ Complete | 56+ functions write audit_logs |
| Rate Limiting | ✅ Complete | Per-client velocity checks |
| FX / Multi-Currency | ✅ Complete | Frankfurter API, XAF/EUR/USD |
| Bulk Transfers | ✅ Complete | CSV-based batch processing |
| Savings/Loans/Ledger | ✅ Complete | Full lifecycle, double-entry |

---

## 5. Recommended Build Priority

```text
Priority 1 (Critical — blocks production)
├── GAP 2: Wire MFA OTP delivery via SMS/email
├── GAP 1: DB Connector production adapter (HTTP-to-SQL bridge)
└── GAP 5: Schedule interbank outbox cron

Priority 2 (High — limits bank onboarding)
├── GAP 6: Bank self-service onboarding wizard
├── GAP 4: connector_pull mode (KOB → Bank REST API)
└── GAP 3: Document Kafka/RabbitMQ limitations + bridge architecture

Priority 3 (Medium — polish)
├── GAP 9: Webhook retry dashboard for Business App
├── GAP 10: Dispute response UI for Business App
├── GAP 8: Virtual cards — wire real KYC docs
└── GAP 7: SDK packages or "Coming Soon" labels

Priority 4 (Low — nice to have)
├── GAP 11: Business App invoice module
└── GAP 12: CI test runner setup
```

---

## 6. Estimated Scope

Building all 12 gaps would involve:
- **4 new edge functions** (bank-api-connector, mfa-deliver wiring, invoice-biz)
- **3 new UI pages** (onboarding wizard, webhook logs, disputes)
- **2 edge function updates** (identity-mfa, identity-login)
- **1 config update** (cron scheduling)
- **2 documentation updates** (SDK labels, broker limitations)

Shall I proceed with building Priority 1 (the 3 critical gaps) first?

