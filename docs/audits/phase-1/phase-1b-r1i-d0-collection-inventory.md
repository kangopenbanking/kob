# Phase 1B — R1I-d.0 — Complete Collection-Operation Inventory

**Method:** Programmatic walk of `public/openapi.json` at v4.53.1. Every `GET` whose `200/application/json` schema references `PaginatedResponse`, an array, or an object with `data: array` is enumerated below. Non-`GET` collection-like reports and stream/export endpoints are called out separately.

**Total operations inventoried:** 483
**Collection-shaped operations identified:** 77 GET operations across 24 domain tags

## 1. Master table

| Operation ID | Method | Path | Domain | Response shape | Classification |
|--------------|--------|------|--------|-----------------|----------------|
$(cat /tmp/inv-rows.md)

## 2. Domain roll-up

| Domain | Collection ops |
|--------|---------------|
| Payment Gateway | 24 |
| Admin | 7 |
| AISP | 6 |
| Webhooks | 5 |
| Merchant Onboarding | 4 |
| Interbank | 3 |
| Loans | 2 |
| Savings | 2 |
| Ledger | 2 |
| Virtual Cards | 2 |
| Operational Controls | 2 |
| Approval Workflows | 2 |
| KYC & Compliance | 2 |
| Monitoring | 2 |
| Bank Connectors | 2 |
| Agents | 2 |
| Certificates, Consent Management, Credit Scoring, WooCommerce, Sandbox, Bank Directory, Payments, CEMAC Remittance | 1 each |

## 3. Notes

- The 5 array-shaped (non-PaginatedResponse) operations (`merchantsQrDirectoryList`, `listWebhookDlq`, `agentList`, `agentTransactionList`, `cemacCorridorsList`) still pass G4 because they declare `LimitParam`/`CursorParam` refs even though the response is an unwrapped array. They are flagged `UNKNOWN_REQUIRES_DECISION` in §4 of the exemption report — either they must adopt the canonical envelope or an explicit bounded-collection exemption must be recorded.
- Stream/export candidates: `getStatementContent`, `gatewayReportTransactions`, `gatewayReportSettlements`, `safeguardingSnapshots` — reports may deliver bounded windows; classified in the mismatch register.
- No POST/PUT search endpoints returning collections were found (searched for schemas with `data:array` in non-GET verbs — none matched).
