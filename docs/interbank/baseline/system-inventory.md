# KOB Interbank Engine — System Inventory (Baseline)

**Date**: 2026-03-20
**Phase**: 0 — Baseline Audit

---

## 1. Existing Payment Flows

| Flow | Module | Status |
|---|---|---|
| PISP (Payment Initiation) | `pisp_consents`, `payments` tables + PISP edge functions | ✅ Active |
| Gateway Charges | `gateway_charges`, `gateway-create-charge` | ✅ Active |
| Gateway Payouts | `gateway_payouts`, `gateway-process-payout` | ✅ Active |
| Gateway Refunds | `gateway_refunds`, `gateway-create-refund` | ✅ Active |
| Mobile Money | `mobile_money_transactions` | ✅ Active |
| Bank Transfers | `bank_transfer_transactions` | ✅ Active |
| Flutterwave Rails | Gateway adapter pattern in `gateway-adapters.ts` | ✅ Active |

## 2. Existing Ledger Infrastructure

| Component | Table/Function | Status |
|---|---|---|
| Ledger Accounts | `ledger_accounts` | ✅ Active |
| Journal Entries | `journal_entries` | ✅ Active |
| Journal Lines | `journal_lines` | ✅ Active |
| Journal Post | `journal-post` edge function | ✅ Active |
| Double-entry enforcement | Via edge function logic | ✅ Active |

## 3. ISO 20022 Endpoints

| Action | Edge Function | Status |
|---|---|---|
| pacs.008 Generate | `iso-messaging` → `pacs008-generate` | ✅ Stateless |
| pacs.002 Generate | `iso-messaging` → `pacs002-generate` | ✅ Stateless |
| camt.053 Parse | `iso-messaging` → `camt053-parse` | ✅ Stateless |
| pain.001 Parse | `iso-messaging` → `pain001-parse` | ✅ Stateless |
| MT103 Generate/Parse | `iso-messaging` → `mt103-*` | ✅ Stateless |
| MT940 Parse | `iso-messaging` → `mt940-parse` | ✅ Stateless |

**Key finding**: All ISO messaging is stateless — generates/parses XML but has no workflow linkage to payment state machines.

## 4. Existing Tables for ISO

- `iso20022_messages` — stores message_id, direction, raw_xml, parsed_data, status
- `iso20022_payment_instructions` — payment instruction records
- `iso20022_credit_transfers` — credit transfer records
- `iso20022_account_statements` — account statement records

## 5. Webhooks / Outbox

- `webhook_endpoints` — merchant webhook registration
- `webhook_deliveries` — delivery tracking with retry logic
- `webhook_inbox` — inbound webhook deduplication
- **No event outbox pattern** for interbank dispatch

## 6. mTLS Infrastructure

- `_shared/mtls.ts` — certificate extraction, thumbprint validation, fingerprint calculation
- `client_certificates` table — certificate storage with PEM, thumbprint, revocation tracking
- **Limitation**: mTLS requires reverse proxy for actual TLS termination (documented constraint)

## 7. Admin Dashboards

- 50+ admin modules under `/admin/*`
- Payment Command Center, Transaction Monitoring, Reconciliation Dashboard exist
- **No dedicated interbank payments admin UI**
- **No connector health monitoring**

## 8. Settlement & Reconciliation

- `settlement_transactions` — settlement tracking
- `bank_reconciliations` — bank reconciliation records
- `gateway-settlement-cron` — automated settlement processing
- `gateway-reconciliation` — reconciliation engine
