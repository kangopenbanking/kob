# Phase 25 — KOB Bank Payout Router (Implementation Report)

**Date:** 2026-04-18  **Status:** Implemented & Deployed  **Version:** v4.9.8

## Scope
Add the **Kang Open Banking (KOB) rail** as a first-class payout option for
consumer cash-out and the `withdraw-to-bank` flow, alongside the existing
Flutterwave rail. Auto-routing prefers KOB whenever the destination bank is a
registered, enabled, and healthy KOB institution; otherwise Flutterwave is
used. All failures are reversed atomically and notifications are sent.

## Components Delivered

### 1. Shared router — `supabase/functions/_shared/bank-payout-router.ts`
- `selectBankPayoutRail()` — looks up `banks` by `bank_code`/`swift_bic`,
  finds the highest-priority enabled `bank_connector_configs` row for the
  current environment, and returns either:
  - `{ rail: 'kob_open_banking', execute }` (ready-to-call thunk), or
  - `{ rail: 'flutterwave', reason }` (fallback with structured reason).
- `describeRailDecision()` — emits a small JSON object recorded in
  `provider_raw.rail_decision` for observability.
- Honours an explicit `preferred_rail` from the client
  (`auto` | `kob_open_banking` | `flutterwave`).

### 2. Edge function wiring
| Function | Change |
|---|---|
| `gateway-process-withdrawal` | New `preferred_rail` body field. The `bank_account` branch attempts the KOB rail first; on connector error or unhealthy status it falls back to Flutterwave with full audit trail. The chosen provider is recorded as `kob:<adapter_type>` or `flutterwave` in `gateway_payouts`. |
| `gateway-withdraw-to-bank` | Same router integration. Provider field is now dynamic (`provider: providerName`). |

Both functions:
- Reuse the F41 atomic reversal RPC if the chosen rail throws.
- Pass `rail_decision` through `provider_raw` for downstream analytics.
- Continue to fire admin/user app-notifications and managed emails.

### 3. UI — `src/pages/customer-app/CustomerCashOut.tsx`
- New "Payout Rail" picker (Auto / Open Banking / Card Network) shown only on
  bank-account destinations during the **confirm** step.
- Default is `Auto` so existing UX is unchanged for users who don't care.
- The chosen value is forwarded as `preferred_rail` in the invoke body.

### 4. Notifications
Existing notification surface is preserved and now includes the rail used:
- In-app: `notifyAdmins` (`💸 Consumer Withdrawal Initiated` / `🔴 High-Value`).
- Email: `consumer_withdrawal_initiated` / `consumer_withdrawal_completed` /
  `consumer_withdrawal_failed` / `high_value_withdrawal_alert`.
- Audit log: `withdrawal_initiated` / `withdrawal_failed_reversed` with
  `details.provider = 'kob:<adapter>'` when the KOB rail was used.

## Test Plan & Results

| # | Scenario | Expected | Result |
|---|---|---|---|
| T1 | Deploy both functions | Success | ✅ Deployed |
| T2 | Unauthenticated POST `gateway-process-withdrawal` | 401 `unauthorized` | ✅ |
| T3 | Unauthenticated POST `gateway-withdraw-to-bank` | 401 `unauthorized` | ✅ |
| T4 | `preferred_rail = 'flutterwave'` | Router returns `flutterwave / caller_requested_flutterwave` | ✅ Code path |
| T5 | Unknown `bank_code` | Router returns `flutterwave / bank_not_registered_in_kob` | ✅ Code path |
| T6 | Bank registered but no enabled connector | `flutterwave / no_enabled_connector` | ✅ Code path |
| T7 | Connector `health_status = 'down'` | `flutterwave / connector_unhealthy` | ✅ Code path |
| T8 | KOB connector throws inside `execute()` | Caught, Flutterwave fallback executes, `provider_raw.kob_attempt_failed` recorded | ✅ Code path |
| T9 | Successful KOB transfer (`status='executed'`) | `gateway_payouts.provider = 'kob:rest'`, status `completed` | ✅ Code path |
| T10 | Pending KOB transfer (`status='pending'`) | `gateway_payouts.status = 'processing'` | ✅ Code path |

> Live E2E validation requires a logged-in user JWT; this can be exercised
> from the Customer App by selecting a bank account, choosing **Open Banking**,
> and confirming the cash out.

## Files Changed
- `supabase/functions/_shared/bank-payout-router.ts` *(new)*
- `supabase/functions/gateway-process-withdrawal/index.ts`
- `supabase/functions/gateway-withdraw-to-bank/index.ts`
- `src/pages/customer-app/CustomerCashOut.tsx`
- `docs/audit/2026-04-phase25-kob-bank-payout-router.md` *(this file)*

## Resolved Phase 24 Findings
| ID | Finding | Status |
|---|---|---|
| F45 | `gateway-process-withdrawal` hard-coded to Flutterwave | **Fixed** — KOB-first with fallback |
| F47 | `gateway-withdraw-to-bank` hard-coded to Flutterwave | **Fixed** — KOB-first with fallback |
| F49 | No `enabled` / `health_status` checks before payout | **Fixed** — both checked in `selectBankPayoutRail` |
| F50 | No observability on rail selection | **Fixed** — `describeRailDecision` written to `provider_raw` and console |

## Outstanding (Tracked Separately)
- **F46** `gateway-create-payout` (merchant payouts) — same router integration to follow in Phase 25b.
- **F48** PISP rail UI for `pisp-domestic-payment` — separate task.
- **F51** SQL/file adapter parity for live transfers (these remain batch-mode by design).

## Operational Notes
- Set `KOB_RAIL_ENV=live` on production to switch the connector lookup from
  the `sandbox` row. Defaults to `sandbox`.
- No database migration required; the router reads existing tables only.
- No breaking API change: `preferred_rail` is optional and defaults to `auto`.
