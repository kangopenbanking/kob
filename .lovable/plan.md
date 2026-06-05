# Nium Global Virtual Accounts — Implementation Plan

## Audit findings

- **No existing edge function** serves the legacy `/v1/gateway/virtual-accounts` paths; only `gateway-query` exposes read-only `list-virtual-accounts` / `get-virtual-account` against an existing `gateway_virtual_accounts` table (NGN/Wema/Flutterwave model).
- **Flutterwave payout rails** are already in place (`gateway-create-payout`, `flutterwave-bank-transfer`, `gateway-webhook-flutterwave`). I will reuse, not replace.
- **Fee Management System** lives in `src/lib/fee-management` + the `fee_categories`/`fee_structures` tables with 49 category check-constraints. I will add 2 new categories (`nium_withdrawal`, `nium_fx_spread`) — additive only.
- **Ledger**: existing double-entry engine (`gateway-fund-account`, escrow wallets, MOD-97 tracking). I will only write through existing helpers, never invent new ledger primitives.
- **OpenAPI** at v4.49.0. Per Standing Orders, all changes are additive → **minor bump to v4.50.0**.

## Build order (5 phases, each independently shippable)

### Phase 1 — Database foundation (1 migration)

New tables (all with GRANTs + RLS + `SECURITY DEFINER` helpers per DB Hardening order):

- `nium_global_accounts` — user_id, nium_customer_hash_id, nium_account_id, currency (USD/EUR/GBP), iban, account_number, routing_code, bic, bank_name, beneficiary_name, status, payout_preference_override (nullable enum), payout_channel_override, created_at.
- `nium_incoming_payments` — idempotency on `nium_transaction_id`, source_amount, source_currency, fx_rate_nium, fx_spread_bps, xaf_credited, xaf_fee, xaf_spread_revenue, routing (`KANG_WALLET`|`MOBILE_MONEY`), ledger_tx_ref, flutterwave_payout_id, status, raw_payload jsonb.
- Add `payout_preference` (`KANG_WALLET` default) + `payout_channel` (nullable phone) to `profiles`.
- New fee categories: `nium_withdrawal` (XAF flat + %), `nium_fx_spread` (bps markup).

### Phase 2 — Backend services (edge functions)

- `_shared/nium-client.ts` — typed client with `NIUM_MODE=stub|live` switch. Stub returns deterministic fake IBAN/USD account so the full flow is testable today. Live mode reads `NIUM_API_KEY`, `NIUM_CLIENT_ID`, `NIUM_BASE_URL`.
- `nium-create-global-account` (POST) — auth required, creates Nium customer + account, persists mapping, returns IBAN/USD details.
- `nium-list-global-accounts` (GET) — per-user.
- `nium-update-payout-preference` (PATCH) — user-level default OR per-VA override.
- `nium-webhook` — public, HMAC-SHA256 verified against `NIUM_WEBHOOK_SECRET`, idempotent on `nium_transaction_id`. On `payment_incoming`:
  1. Look up VA → user.
  2. Resolve effective routing (VA override → user default → KANG_WALLET).
  3. Compute `xaf_gross = source_amount * nium_rate * (1 - spread_bps/10000)` and capture spread as revenue.
  4. If KANG_WALLET → credit user XAF via existing ledger helper.
  5. If MOBILE_MONEY → call `gateway-fee-estimate` for `nium_withdrawal`, deduct, then invoke existing `gateway-create-payout` (Flutterwave MoMo). Ledger entries: Dr Nium suspense / Cr User wallet / Cr fee revenue / Cr spread revenue, then Dr User / Cr MoMo float on payout success.
  6. Always 200 to Nium after persistence; payout dispatch is async via existing retry worker.

### Phase 3 — Frontend (Customer App)

- New page `src/pages/customer-app/GlobalReceivingAccount.tsx`:
  - Empty state CTA "Generate Global Receiving Account".
  - List of VAs with copy-to-clipboard IBAN/account/routing.
  - Routing preference selector (radio: Kang Wallet / Mobile Money + phone field) — saves user default and per-VA override.
  - Incoming payments history table from `nium_incoming_payments`.
- Link from `CustomerHome` "Receive money internationally" card.

### Phase 4 — Documentation & SDK

- `public/openapi.json` + `openapi.yaml` + sandbox copies → add 4 new operations under `/v1/gateway/global-accounts`. Bump `info.version` to `4.50.0`. Cite FAPI 1.0 + RFC 8259. No removals → no allowlist change needed.
- `public/CHANGELOG.md` + `public/changelog.json` → entry `v4.50.0 — Nium Global Virtual Accounts`, `breaking_changes: false`, list new ops + new fee categories + deprecation notice for legacy NGN endpoints (sunset date 90 days out per Standing Order 1).
- New guide: `docs/developer-portal/payments/global-accounts.md` with cURL + Node.js + Python examples (Standing Order P9, P5 — runnable against stub sandbox).
- New page: `src/pages/developer/GatewayGlobalAccountsGuide.tsx` mirroring `GatewayVirtualAccountsGuide` pattern.
- SDK resources: add `GlobalAccountsResource` to `packages/sdk-node`, `sdk-python`, `sdk-php` (mirroring existing `PayoutsResource` shape). Bump SDK versions.

### Phase 5 — Tests & gates

- Vitest: `nium-webhook.test.ts` — signature verify, idempotency, KANG_WALLET path, MOBILE_MONEY path, fee deduction math, spread revenue capture.
- Direct-backend-guard, openapi-parity, no-double-v1, version-sync — all existing CI gates must still pass.
- Postman collection regenerated for v4.50.0.

## Technical details

- **Stub-first**: `NIUM_MODE` defaults to `stub`. Going live = setting 3 secrets + flipping the env var; no code change.
- **Spread default**: 75 bps (configurable via `fee_structures` row, not hardcoded).
- **Idempotency**: webhook uses `nium_transaction_id` as unique key + row-level `FOR UPDATE` lock per memory rules.
- **Legacy `/v1/gateway/virtual-accounts`**: untouched in this release. Deprecation header (`Sunset:`) added in a follow-up minor; removal requires v5.0.0 per Standing Order 1.
- **RLS**: `nium_global_accounts` — owner-only via `auth.uid() = user_id`; admin via `has_role(auth.uid(),'admin')`. `nium_incoming_payments` — same. Service role full access for the webhook + payout worker.

## Out of scope (explicit)

- KYC uplift for Nium customer creation (assumes existing KOB KYC tier is sufficient; will add a TODO + admin alert if Nium returns KYC_REQUIRED).
- Multi-currency sub-balances (rejected — using "Nium FX + spread at credit time").
- Removing or renaming legacy NGN VA endpoints (forbidden without v5 bump).

## Deliverable order

1. Migration (Phase 1) — requires your approval before running.
2. Edge functions + nium-client stub (Phase 2).
3. Frontend page (Phase 3).
4. OpenAPI + changelog + SDK + docs (Phase 4).
5. Tests (Phase 5).

Approve and I'll start with the migration.
