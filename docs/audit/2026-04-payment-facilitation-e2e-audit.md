# Payment Facilitation — E2E Audit Report

**Date:** 2026-04-20  
**Scope:** `/admin/payment-facilitation`, `/payment-facilitation`, `/developer/payment-facilitation`, all underlying KOB API endpoints, edge functions, database tables, and routing infrastructure.  
**Standard:** Same audit format as `2026-04-phase4-payment-gateway.md` and `payment-gateway-e2e-audit-2026-03-08.md`.

---

## 1. Executive Summary

| Layer | Status | Notes |
|---|---|---|
| Admin dashboard (`/admin/payment-facilitation`) | ✅ Live | Realtime feed, stats, settlement tab, integration guide all functional |
| Public landing (`/payment-facilitation`) | ✅ Live | Marketing + 4-step flow + pricing |
| Developer docs (`/developer/payment-facilitation`) | ✅ Live | All 4 endpoints documented with examples |
| Edge functions (4) | ✅ Deployed | `verify_jwt = false` confirmed in `config.toml` |
| Database tables / RPCs | ✅ Live | `institutions.use_kob_flutterwave`, `is_kob_facilitated` flags, `calculate_settlement_balance` RPC all present |
| **REST routing** `/v1/banking/facilitated-*`, `/v1/settlement/*` | ❌ → ✅ **Fixed** | No router mapped these documented paths to the leaf functions |
| OpenAPI ↔ leaf contract drift | ❌ → ✅ **Fixed** | `/v1/banking/facilitated-transfer` advertised wrong field names |
| Postman collection | ✅ Live | All 4 routes present |

**Overall before fix:** 6/8 layers production-ready. **After fix:** 8/8.

---

## 2. Inventory

### 2.1 Frontend pages
| Route | Component | Purpose |
|---|---|---|
| `/admin/payment-facilitation` | `src/pages/admin/PaymentFacilitation.tsx` | Admin oversight dashboard (live feed, failed payments, settlements, integration guide) |
| `/payment-facilitation` | `src/pages/PaymentFacilitation.tsx` | Public marketing page |
| `/developer/payment-facilitation` | `src/pages/developer/PaymentFacilitation.tsx` | Developer API reference |

### 2.2 Edge functions
| Function | Purpose | Auth | Verified |
|---|---|---|---|
| `facilitated-mobile-money-charge` | Initiate KOB-facilitated MoMo collection via Flutterwave | Bearer (user) | ✅ |
| `facilitated-bank-transfer` | Initiate KOB-facilitated bank payout via Flutterwave | Bearer (user) | ✅ |
| `settlement-calculate` | Compute net settlement for institution period | Bearer (user) | ✅ |
| `settlement-process` | Execute settlement payout to institution | Bearer (admin) | ✅ |

### 2.3 Database
- `institutions.use_kob_flutterwave` (boolean) — gating flag (1 active institution detected)
- `mobile_money_transactions.is_kob_facilitated` + `kob_fee_amount` columns — present
- `bank_transfer_transactions.is_kob_facilitated` + `kob_fee_amount` columns — present
- RPC `calculate_settlement_balance(_institution_id, _period_start, _period_end)` — present
- RPC `calculate_transaction_fee(_institution_id, _transaction_type, _transaction_amount)` — present
- Settlement tables: `settlement_runs`, `settlement_transactions`, `settlement_reviews`, `gateway_settlements` — present

### 2.4 Documented public endpoints
| Method | Path | Leaf function |
|---|---|---|
| POST | `/v1/banking/facilitated-mobile-money-charge` | `facilitated-mobile-money-charge` |
| POST | `/v1/banking/facilitated-transfer` | `facilitated-bank-transfer` |
| POST | `/v1/settlement/calculate` | `settlement-calculate` |
| POST | `/v1/settlement/process` | `settlement-process` |

---

## 3. Findings

### 🔴 Finding 1 — Missing REST routing (CRITICAL)
**Severity:** Critical  
**Status:** ✅ **FIXED**

The OpenAPI spec, Postman collection, and developer docs all advertise four REST paths under `/v1/banking/*` and `/v1/settlement/*`. None of these were routed by the existing `gateway`, `banking-api-router`, or any other public router. Calling the documented URLs would have returned `404 Function not found`.

**Fix:** Created `supabase/functions/payment-facilitation-router/index.ts`, a thin REST→edge-function bridge mirroring the pattern used by `supabase/functions/gateway/index.ts`. Registered with `verify_jwt = false` in `supabase/config.toml`. The router translates each documented path 1:1 to its leaf function and forwards Bearer auth + body unchanged.

### 🟠 Finding 2 — OpenAPI contract drift (HIGH)
**Severity:** High  
**Status:** ✅ **FIXED**

The `/v1/banking/facilitated-transfer` schema in `public-api-spec` advertised `bank_code`, `account_name`, and required `institution_id`. The leaf function actually accepts `account_bank`, `beneficiary_name`, and derives the institution from the authenticated user. Developers following the spec verbatim would hit `400`.

**Fix:** Updated the spec to match the leaf contract (`account_bank`, `beneficiary_name`, no `institution_id`), aligned tags to `Payment Facilitation`, and corrected the response schema (`success`, `transaction_ref`, `transfer_id`, `kob_fee_amount`, `net_amount`, `status`).

### 🟡 Finding 3 — `account_bank` parameter naming (LOW)
**Severity:** Low / Informational  
**Status:** Not addressed (additive change required)

The leaf function's `account_bank` field name is non-standard vs. the rest of the API which uses `bank_code`. Renaming would break existing integrations and require a v5 increment per Standing Order 1 (THE LOCK). **Recommendation:** Plan a non-breaking dual-accept (`bank_code || account_bank`) in v4.10.0.

### 🟢 Finding 4 — Empty production data
**Severity:** Informational  
**Status:** Expected

Database snapshot: 1 facilitated institution, 0 facilitated MoMo transactions, 0 facilitated bank transfers. The system is wired correctly; no live transactions yet.

---

## 4. Verification Matrix

| Test | Before | After |
|---|---|---|
| `POST /v1/banking/facilitated-mobile-money-charge` reaches leaf | ❌ 404 | ✅ via `payment-facilitation-router` |
| `POST /v1/banking/facilitated-transfer` reaches leaf | ❌ 404 | ✅ via `payment-facilitation-router` |
| `POST /v1/settlement/calculate` reaches leaf | ❌ 404 | ✅ via `payment-facilitation-router` |
| `POST /v1/settlement/process` reaches leaf | ❌ 404 | ✅ via `payment-facilitation-router` |
| OpenAPI `/v1/banking/facilitated-transfer` schema matches leaf | ❌ Drift | ✅ Aligned |
| Postman collection includes all 4 endpoints | ✅ | ✅ |
| Developer doc page lists all 4 endpoints | ✅ | ✅ |
| Admin dashboard reads `is_kob_facilitated` filter | ✅ | ✅ |
| Realtime subscription on facilitated tables | ✅ | ✅ |
| Settlement RPC `calculate_settlement_balance` exists | ✅ | ✅ |
| `use_kob_flutterwave` gating enforced in all 4 leaves | ✅ | ✅ |
| Admin role check enforced in `settlement-process` | ✅ | ✅ |

---

## 5. Files Changed

| File | Change |
|---|---|
| `supabase/functions/payment-facilitation-router/index.ts` | **Created** — REST router for the 4 documented paths |
| `supabase/config.toml` | Registered `payment-facilitation-router` (`verify_jwt = false`) |
| `supabase/functions/public-api-spec/index.ts` | Aligned `/v1/banking/facilitated-transfer` schema with leaf contract |

---

## 6. Sign-off

- **Guardian:** No `operationId`, path key, or component name was removed. Only schema field names corrected to match deployed leaf (Standing Order 4 — Surgeon Rule, additive correction).
- **Architect:** Routing layer now consistent with existing `gateway` REST translator pattern.
- **Surgeon:** Three minimal, focused changes; no leaf logic touched.
- **Auditor:** Contract drift closed; spec, postman, docs, and runtime now agree.
- **Scorekeeper:** Payment Facilitation moves from **6/8 → 8/8** production-ready.

`info.version` recommendation: bump to **4.9.8** (patch — additive routing + spec correction).
