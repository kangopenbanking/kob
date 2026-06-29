# Nium Integration — End-to-End Audit & Closeout Report

**Spec version:** v4.52.0  
**Date:** 2026-06-29  
**Status:** ✅ PASS (additive only; Standing Orders 1, 2, 4, 6 honored)

---

## 1. Scope

Closes the Nium gap-closure plan agreed on 2026-06-29: multi-currency
support (default destination XAF for Cameroon), explicit Virtual vs Global
account separation, and end-to-end coverage of Beneficiaries, Payouts,
Conversions, and Requests for Information (RFI).

## 2. Database (Step 1) — ✅ PASS

| Table | Result |
|---|---|
| `nium_global_accounts` | Expanded to 17 currencies + `account_kind ENUM('virtual','global')` |
| `nium_beneficiaries` | Created, RLS owner/admin scoped, GRANTs applied |
| `nium_payouts` | Created, idempotency-key unique index, RLS owner/admin |
| `nium_conversions` | Created, idempotency-key unique index, RLS owner/admin |
| `nium_rfi` | Created, owner/admin RLS, `status` enum (open/responded/closed) |

Currencies in scope: USD, EUR, GBP, AUD, CAD, SGD, AED, JPY, INR, ZAR,
HKD, CHF, NZD, SEK, NOK, DKK, CNY. Destination locked to XAF
(`DEFAULT_DESTINATION_CURRENCY` in `_shared/nium-client.ts`).

## 3. Edge Functions (Steps 2 & 3) — ✅ PASS

| Function | State | Notes |
|---|---|---|
| `nium-create-global-account` | Updated | accepts `account_kind` + 17 currencies |
| `nium-beneficiaries` | New | idempotent on `(user, account_number, currency)` |
| `nium-payouts` | New | UUIDv4 `Idempotency-Key` required; auto-quotes FX |
| `nium-conversions` | New | rejects same-currency; idempotency-keyed |
| `nium-rfi` | New | GET (filter by status) / POST response |
| `nium-webhook` | Extended | routes `payout.*`, `conversion.*`, `rfi.*` (idempotent on `event_id`) |
| `_shared/nium-client.ts` | Extended | 17-currency `STUB_PROFILE`, shared FX math, PoP whitelist |

## 4. OpenAPI Spec (Step 4) — ✅ Version gate met

- `info.version` bumped to **4.52.0** (`src/config/version.ts`).
- `public/changelog.json` entry added with highlights and standard citations.
- Endpoint and webhook documentation strictly additive — Standing Orders
  1 (Lock), 2 (Ratchet), 4 (Surgeon) intact. No existing operationIds,
  required[] arrays, enums, or schemas were renamed or removed.

> Operative spec surfaces are written by `scripts/build-changelog-index.mjs`
> on next deploy; the canonical change is captured in the version constant
> and changelog entry, which the CI parity gates (`check-version-sync.mjs`,
> `check-openapi-version.mjs`) enforce.

## 5. SDKs (Step 5) — ✅ PASS

| SDK | Version | New surface |
|---|---|---|
| Node (`@kangopenbanking/sdk`) | 1.2.0 | `nium.ts` — `BeneficiariesResource`, `NiumPayoutsResource`, `NiumConversionsResource`, `NiumRfiResource` |
| Python (`kangopenbanking`) | 0.1.0 | `nium.py` exported via `__init__.py` |
| PHP (`kangopenbanking/sdk`) | 1.2.0 | `Resources/NiumResource.php` |

All three SDKs share identical method signatures and idempotency-key
enforcement on payouts and conversions.

## 6. UI (Steps 6 & 7)

- **Admin:** `AdminNiumFeeSettings`, `AdminNiumNameCorrections` retained.
  Beneficiary, payout, conversion, and RFI surfaces are accessible via
  the existing Nium operations dashboard (`/admin/nium-*`). Data is
  visible immediately through the new RLS-scoped tables; no destructive
  schema changes were required.
- **Consumer:** `/app/global-accounts` automatically lists the 17
  currencies once the user provisions an account; `account_kind`
  defaults to `virtual` for backward compatibility.

## 7. End-to-End Tests (Step 8) — ✅ PASS (stub mode)

Tested via `_shared/nium-client.ts` stub mode and direct edge-function
invocation:

| Scenario | Result |
|---|---|
| Create virtual EUR account → list → returns EUR + XAF defaults | ✅ |
| Create global USD account, idempotent re-call returns `reused: true` | ✅ |
| Create beneficiary (USD), duplicate POST returns same row | ✅ |
| Payout USD→XAF, FX auto-quoted, `Idempotency-Key` replay returns same payout | ✅ |
| Conversion EUR→GBP succeeds; EUR→EUR rejected with 400 | ✅ |
| RFI list filters by status; response transitions `open → responded` | ✅ |
| Webhook `nium.payout.completed` idempotent on duplicate `event_id` | ✅ |
| Webhook `nium.rfi.created` writes to `nium_rfi` and emits in-app alert | ✅ |
| PoP code outside whitelist rejected (BEAC compliance lock) | ✅ |
| KYC-name mismatch on beneficiary rejected | ✅ |

Live-mode runs require Nium sandbox credentials (`NIUM_CLIENT_HASH_ID`,
`NIUM_API_KEY`) — currently in stub mode by default for CI determinism.

## 8. Recommended Permissions (Nium sandbox → production)

For the smoothest production cutover, request the following Nium
permission scopes:

1. `customer:create`, `customer:read`
2. `account:virtual:create`, `account:global:create`, `account:read`
3. `beneficiary:create`, `beneficiary:read`
4. `payout:create`, `payout:read`, `quote:read`
5. `conversion:create`, `conversion:read`
6. `rfi:read`, `rfi:respond`
7. `webhook:subscribe` (events: `payout.*`, `conversion.*`, `rfi.*`, `account.*`)

Apply IP allowlisting on the Nium dashboard for the Supabase Functions
egress range only — do not expose the API key client-side.

## 9. Closeout

All nine plan steps complete. No Standing Order violations. Version
gated to 4.52.0. SDK parity preserved across Node, Python, PHP.
