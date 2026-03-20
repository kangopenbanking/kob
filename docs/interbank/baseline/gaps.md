# KOB Interbank Engine — Gap Analysis

**Date**: 2026-03-20
**Phase**: 0 — Baseline Audit

---

## Critical Gaps (Filled by Phase 2 + 3)

| # | Gap | Impact | Resolution |
|---|---|---|---|
| 1 | No `interbank_participants` table | Cannot register banks as interbank participants | Phase 2.1 — Created |
| 2 | No `interbank_payments` table | Cannot track interbank payment lifecycle | Phase 2.1 — Created |
| 3 | No `interbank_messages` table | ISO messages not linked to payment workflows | Phase 2.1 — Created |
| 4 | No `interbank_status_events` table | No audit trail for payment state transitions | Phase 2.1 — Created |
| 5 | No payment state machine | No enforcement of valid status transitions | Phase 2.1 — `interbank-engine` |
| 6 | ISO messaging is stateless | pacs.008/pacs.002/camt.054 don't drive payment workflows | Phase 2.2 — Canonical mapping |
| 7 | No outbox/dispatch pattern | No reliable message delivery to bank connectors | Phase 2.4 — `event_outbox` + dispatch worker |
| 8 | No bank connector registration | Banks cannot register endpoints for receiving instructions | Phase 3.1 — Connector management |
| 9 | No connector inbound endpoint | Banks cannot send pacs.002/camt.054 back to KOB | Phase 3.1 — `interbank-connector-inbound` |
| 10 | No interbank admin UI | Admins cannot monitor interbank payments | Phase 3.3 — `AdminInterbankPayments` |
| 11 | No sandbox interbank simulator | Developers cannot test interbank flows | Phase 4 — Sandbox simulator |
| 12 | No interbank reconciliation | No automated reconciliation for interbank clearing | Phase 2.1 — `interbank_reconciliation_items` |
| 13 | No file fallback mode | Banks without APIs cannot participate | Phase 3.4 — File generation + CSV import |

## Existing Infrastructure Leveraged (Not Modified)

- `iso-messaging` edge function (XML generation/parsing)
- `journal-post` ledger engine
- `_shared/mtls.ts` mTLS utilities
- `client_certificates` table
- Gateway settlement/reconciliation infrastructure
- Admin portal architecture and navigation system
