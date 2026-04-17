# KOB Platform — System Inventory (Phase 1)

Date: 2026-04-17
Scope: Read-only enumeration. No code or schema changes in this phase.

## 1. Top-level counts

| Surface | Count |
|---|---|
| Edge functions (excluding `_shared`) | **304** |
| Frontend routes (App.tsx) | **556** |
| Public schema tables | **402** |
| Public schema functions (RPC/triggers/helpers) | **125** |
| Active RLS policies | **940** |
| Triggers (non-internal) | **168** |
| Active cron jobs | **12** |

## 2. Edge function domain breakdown

| Domain | Count | Examples |
|---|---|---|
| Bank connectors / Open Banking (`bank-*`, `aisp-*`, `pisp-*`, `cbpii-*`, `consent-*`) | 30 | `bank-data-poller`, `bank-data-router`, `bank-retry-worker`, `bank-reconcile-engine`, `aisp-accounts`, `consent-status` (NEW), `consent-extend` (NEW) |
| Payments / Gateway / Mobile Money | 63 | `payment-router-charge`, `mobile-money-charge`, `gateway-checkout`, `flutterwave-webhook` |
| Admin operations | 22 | `admin-list-consents`, `admin-kyc-review`, `admin-rotate-jwt-secret` |
| Other (POS, KYC, ledger, identity, AI, etc.) | 189 | `process-transaction`, `firebase-phone-verify`, `pos-store-browse` |

## 3. Active cron jobs (12)

| Job | Schedule | Purpose |
|---|---|---|
| `auto-withdrawal-cron-5min` | `*/5 * * * *` | Auto-withdrawal sweeps |
| `automated-settlement-daily` | `0 2 * * *` | Daily settlement run |
| **`bank-data-poller-5min`** | `*/5 * * * *` | **NEW (Phase 0) — Bank connector polling** |
| **`bank-retry-worker-2min`** | `*/2 * * * *` | **NEW (Phase 0) — Retry queue replay** |
| `byo-charge-poller-30s` | `*/1 * * * *` | BYO charge status polling |
| `check-subscription-expiry-emails` | `0 8 * * *` | Subscription expiry emails |
| `expire-stale-approvals-every-15-min` | `*/15 * * * *` | Approval expiry |
| `expire-store-subscriptions` | `0 * * * *` | Store subscription expiry |
| `interbank-outbox-dispatch` | `*/2 * * * *` | Interbank outbox dispatcher |
| `notify-subscription-expiry-warning` | `0 9 * * *` | Subscription warnings |
| `process-email-queue` | `5 seconds` | Email queue processor |
| `recurring-payments-hourly` | `0 * * * *` | Recurring payments |

## 4. Frontend route surface (556 routes)

| Group | Approx count | Notes |
|---|---|---|
| Public marketing + docs (`/`, `/about`, `/api/*`, `/architecture/*`, `/guides`) | 24 | All must remain public per Order P1 |
| Developer portal (`/developer/*`) | Routes nested under DeveloperLayout | Public-access mandate |
| Admin portal (`/admin/*`) | Nested via AdminLayout | Auth-gated |
| Banking app (`/bank-dashboard/*`, `/bank/:institutionId/*`, `/banking-app/*`) | 14+ | Tenant-scoped |
| Consumer PWA (`/app/*`) | Multi-tenant | Auth-gated |
| Business PWA (`/biz/*`) | Multi-tenant | Auth-gated |

## 5. Risk areas surfaced (no fixes in this phase)

1. **Endpoint-to-function discoverability**: 304 edge functions, only a subset are referenced in `openapi.json` `/v1/*` paths. Phase 5 will produce the full diff.
2. **Banking domain density**: 30 bank-related functions feeding 14+ bank routes — Phase 2 target.
3. **Schema fragmentation** (carryover from Wave 5.1): `bank_sourced_*` vs `bank_side_*` co-exist. Documented; bridging deferred to P2.
4. **RLS surface**: 940 policies — Phase 6 will run `supabase--linter` for security regressions.

## 6. Phase 1 exit criteria — met

- [x] Edge function count enumerated (304)
- [x] Cron jobs enumerated (12, both Wave 5 jobs verified active)
- [x] DB surface counted (402 tables, 125 functions, 940 policies, 168 triggers)
- [x] Frontend route count enumerated (556)
- [x] No code or schema changes

## 7. Next phase

**Phase 2 — Banking Layer Deep Audit** (requires approval). Will cover: live connector E2E with one synthetic sandbox bank, polling watermark validation, retry queue exercise, reconciliation mismatch flagging, adapter failover. All additive per Standing Order 4.
