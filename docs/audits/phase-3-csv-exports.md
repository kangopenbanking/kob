# Phase 3 — CSV Exports for Reports (Additive)

**Date:** 2026-04-30
**Spec version:** `4.18.0` → `4.19.0` (minor, additive)
**Standing Order audit:** SO-1 Lock ✅ · SO-2 Ratchet ✅ · SO-3 Audit Trail ✅ · SO-4 Surgeon ✅ · SO-5 Dead Code ✅ · SO-6 Version Gate ✅

## Summary

Adds optional CSV output to the three pre-existing reporting operations and
backs them with a real edge function (`gateway-reports`). JSON behavior is
**unchanged** — `format` defaults to `json`, so all current consumers see no
diff.

## Operations affected (no rename, no removal)

| operationId | Path | Existing 200 | New 200 |
|---|---|---|---|
| `gatewayReportTransactions` | `GET /v1/gateway/reports/transactions` | `application/json` | `+ text/csv` |
| `gatewayReportSettlements`  | `GET /v1/gateway/reports/settlements`  | `application/json` | `+ text/csv` |
| `gatewayReportFees`         | `GET /v1/gateway/reports/fees`         | `application/json` | `+ text/csv` |

Each operation also gains three additive query params:

| Param | Type | Default | Notes |
|---|---|---|---|
| `format` | `string` enum `[json, csv]` | `json` | New |
| `limit`  | `integer` 1–1000 | `100` | Standard pagination |
| `offset` | `integer` ≥ 0    | `0`   | Standard pagination |

## Backend (new, additive)

`supabase/functions/gateway-reports/index.ts`

- Bearer JWT required (`supabase.auth.getUser`).
- Merchant scoping via `gateway_merchants.user_id = auth.uid()`. Admins (via
  `public.has_role(uid, 'admin')`) may pass `merchant_id` for any merchant.
- 90-day max date range guard (existing `PAY_020` contract).
- CSV uses RFC 4180 escaping; `Content-Disposition: attachment`.
- Aggregation for fees: groups by `(channel, currency)` over `success` charges.

## Compliance & justification

- **RFC 4180** — CSV serialization format.
- **PSD2 RTS Article 10 §2** — merchant access to settlement/fee data must be
  available in machine-readable form. CSV satisfies the spreadsheet/finance
  team workflow alongside the existing JSON.
- **FAPI 1.0 Adv §6.2** — bearer-only access preserved; no new security
  scheme introduced (SO-5 satisfied).

## Backwards compatibility

- No path, operationId, security scheme, schema name, or required field was
  renamed or removed (SO-1).
- No existing 200 response content was modified — `text/csv` is added as a
  sibling to `application/json` (SO-2 ratchet preserved).
- All Phase 1.5 ratchet tests pass:
  - `openapi-2xx-schema-coverage.test.ts` — 1/1
  - `openapi-operation-id-uniqueness.test.ts` — 2/2
  - `openapi-security-declared.test.ts` — 2/2

## Files touched

- `supabase/functions/gateway-reports/index.ts` (new)
- `public/openapi.json` — version bump + 12 additive entries
- `public/openapi.yaml` — mirrored, 12 additive entries
- `docs/audits/phase-3-csv-exports.md` (this file)
