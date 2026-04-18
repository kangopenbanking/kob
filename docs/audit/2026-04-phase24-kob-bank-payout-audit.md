# Phase 24 — Kang Open Banking Bank Cash-Out / Payout Audit

**Date:** 2026-04-18  
**Scope:** Consumer App + Business App withdrawals & payouts that should land in
end-user / merchant **bank accounts at banks registered as financial
institutions on the Kang Open Banking (KOB) API**.  
**Reviewer:** Guardian / Architect / Surgeon / Auditor / Scorekeeper  
**Format:** Phase-23 standard audit format

---

## 1. Executive Summary

| Metric | Result |
|---|---|
| Total user-facing bank-payout flows reviewed | 4 |
| Flows currently routed through KOB partner banks | **0 / 4** |
| Flows hard-coded to Flutterwave | 4 / 4 |
| KOB bank-connector rails available but unused | REST, SQL, File, SOAP, MQ |
| PISP `pisp-domestic-payment` reachable from consumer/business UI | **No** |
| Severity | **HIGH** — strategic capability gap |

> The platform ships a complete bank-connector framework
> (`bank_connector_configs` + `_shared/bank-connectors/*` with
> `initiateTransfer()` on every adapter) **and** a fully FAPI-compliant PISP
> rail (`pisp-domestic-payment` against `pisp_consents`), but **no consumer or
> business cash-out path uses either of them**. Every "withdraw to bank"
> request is hard-pinned to `createFlutterwavePayout()`.

---

## 2. Flows Reviewed

| # | Flow | Edge function | Provider used today | KOB bank used? |
|---|---|---|---|---|
| 1 | Consumer manual cash-out → bank | `gateway-process-withdrawal` (`destination_type=bank_account`) | `flutterwave` only | ❌ |
| 2 | Consumer "Withdraw to bank" (legacy) | `gateway-withdraw-to-bank` | `flutterwave` only | ❌ |
| 3 | Merchant payout → bank | `gateway-create-payout` (`channel=bank_transfer`) | `flutterwave` only | ❌ |
| 4 | Auto-withdrawal cron → bank | `gateway-auto-withdrawal-cron` → `gateway-create-payout` | `flutterwave` only | ❌ |

---

## 3. Findings

### F45 — No KOB bank routing on consumer cash-out (**HIGH**)
**File:** `supabase/functions/gateway-process-withdrawal/index.ts` L296-308  
**Issue:** When `destination_type === 'bank_account'`, the function calls
`createFlutterwavePayout()` unconditionally. It never inspects whether the
beneficiary bank is a registered KOB institution (`institutions` /
`bank_connector_configs`) nor whether a working `BankConnector.initiateTransfer()`
exists for that bank.  
**Impact:** Even a withdrawal *to a Kang-registered bank account* leaves the
KOB rail and pays Flutterwave fees + intermediary risk.  
**Fix:** Introduce a router (`selectBankPayoutRail()`) that:  
1. Looks up the destination `bank_code` against `institutions` /
   `bank_connector_configs.enabled = true`.  
2. If a KOB connector exists → `getBankConnector(adapter_type).initiateTransfer()`.  
3. Else → fall back to Flutterwave.

### F46 — No KOB bank routing on merchant payouts (**HIGH**)
**File:** `supabase/functions/gateway-create-payout/index.ts` L78  
**Issue:** Identical to F45 for merchant payouts — `createFlutterwavePayout()`
is invoked directly with no rail selection.  
**Fix:** Same `selectBankPayoutRail()` router.

### F47 — `gateway-withdraw-to-bank` ignores `bank_connector_configs` (**HIGH**)
**File:** `supabase/functions/gateway-withdraw-to-bank/index.ts` L139  
**Issue:** Bank code is captured but only forwarded to Flutterwave; no lookup
against the KOB bank registry.  
**Fix:** Same router. This function should be deprecated and forward to
`gateway-process-withdrawal` to keep one rail-selection codepath.

### F48 — PISP `pisp-domestic-payment` is not reachable from consumer/business UI (**MEDIUM**)
**Search:** `grep -rln "pisp-domestic" src/` returns **no consumer/business
caller** — only documentation pages.  
**Issue:** The fully FAPI-compliant PISP rail (which is the canonical Open
Banking pay-out method) is built, signed (JWS), and tested but never invoked
by the apps.  
**Fix:** Add a "Pay via Open Banking" option in `CustomerCashOut.tsx` and
merchant payout that walks the PISP consent flow then calls
`pisp-domestic-payment` for users whose source account is at a KOB-registered
bank.

### F49 — `bank_connector_configs.enabled` not checked at payout time (**MEDIUM**)
**Issue:** The bank-connector health table (`bank_connector_health`) and
`enabled` flag are populated by `bank-data-poller`, but no payout function
reads them. A bank could be unhealthy and a transfer still attempted.  
**Fix:** `selectBankPayoutRail()` must require
`enabled = true AND health_status IN ('healthy','degraded')`, otherwise fall
back.

### F50 — No audit / observability for rail decision (**LOW**)
**Issue:** Even if a KOB rail were used, there is no `audit_logs` event
recording *which* rail was selected and *why*. Operators cannot answer "what
% of bank payouts went through KOB vs Flutterwave?".  
**Fix:** Emit `payout_rail_selected` audit event with
`{ rail, bank_id, reason, fallback_from }`.

### F51 — Adapter `initiateTransfer()` parity gap (**LOW**)
**Files:** `_shared/bank-connectors/sql-bank.ts` L128,
`_shared/bank-connectors/file-bank.ts` L123  
**Issue:** `sql` and `file` adapters intentionally reject `initiateTransfer`
(read-only / batch-only). Only `rest` (and SOAP via payment-connectors)
support live transfers. This is correct, but `selectBankPayoutRail()` must
filter on `adapter_type IN ('rest','soap')` for live payouts and queue
`file`/`sql` banks via `bank_batch_jobs`.  
**Fix:** Encode the capability matrix in the router.

---

## 4. Capability Matrix (target state)

| Adapter | Live transfer | Batch payout | Audit | Fallback if down |
|---|---|---|---|---|
| `rest` | ✅ `initiateTransfer` | — | required | Flutterwave |
| `soap` | ✅ via payment-connectors | — | required | Flutterwave |
| `file` | ❌ | ✅ `bank_batch_jobs` | required | Flutterwave |
| `sql` | ❌ | ✅ scheduled poll | required | Flutterwave |
| `mq` | ✅ async | — | required | Flutterwave |

---

## 5. Recommended Remediation Plan (next phase)

| Step | Deliverable |
|---|---|
| 1 | Create `_shared/bank-payout-router.ts` exposing `selectBankPayoutRail({ bank_code, currency, amount })`. |
| 2 | Wire it into `gateway-create-payout`, `gateway-process-withdrawal`, `gateway-withdraw-to-bank`. |
| 3 | Add `payout_rail_selected` audit event + `gateway_payouts.rail` column. |
| 4 | Surface "Pay via Open Banking (PISP)" option in `CustomerCashOut.tsx` and merchant payout UI for source accounts at KOB banks. |
| 5 | Operator dashboard: rail-distribution metric. |
| 6 | E2E test: withdrawal to a seeded KOB bank goes via `restBankConnector.initiateTransfer`, not Flutterwave. |

---

## 6. Verdict

The Kang Open Banking platform **owns** the infrastructure to settle
withdrawals and payouts directly via its registered partner banks, but
**none of the user-facing flows exercise it**. This is a strategic gap, not
an outage — every rail still completes via Flutterwave — but until F45/F46/F47
are remediated, the KOB bank rail is dark code and the platform's open-banking
value proposition is not realised at the point of cash-out.

**Status:** Findings filed. Awaiting approval to implement the remediation
plan (Phase 25 — KOB Bank Payout Router).
