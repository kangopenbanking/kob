# KOB Interbank Engine Report — v4.3.0

**Date**: 2026-03-22

## State Machine (10 States)

```
created → validated → submitted → accepted → in_process → settled
                  ↘ failed ↗        ↘ rejected → reversed
                  ↘ expired          settled → reversed
                                     failed → reversed
```

| State | Description | Ledger Action |
|-------|-------------|---------------|
| `created` | Payment initiated | None |
| `validated` | Data validated | None |
| `submitted` | Sent to clearing | Funds reserved |
| `accepted` | Accepted by receiving bank | — |
| `in_process` | Being processed | — |
| `settled` | Clearing complete | Funds finalized |
| `rejected` | Rejected by receiving bank | Funds released |
| `failed` | Processing failure | Funds released |
| `reversed` | Reversed after settlement | Reversal entry |
| `expired` | Timed out | Funds released |

## ISO 20022 Message Mapping

| Message Type | Purpose | Implementation |
|-------------|---------|---------------|
| `pain.001` | Payment initiation | ✅ `generate_instruction_file` |
| `pacs.008` | FI-to-FI credit transfer | ✅ `generate_pacs008` |
| `pacs.002` | Payment status report | ✅ `process_pacs002` |
| `camt.054` | Bank-to-customer debit/credit notification | ✅ `process_camt054` |

## Actions (25 total)

| Category | Actions | Status |
|----------|---------|--------|
| Payment Lifecycle | create, get, list, submit, reverse, transition_status | ✅ |
| ISO 20022 | generate_pacs008, process_pacs002, process_camt054 | ✅ |
| Messages | list_messages, get_message | ✅ |
| Participants | create, list, update | ✅ |
| Connectors | register, upload_cert, health, rotate_keys, list | ✅ |
| Outbox | list_outbox, replay_outbox | ✅ |
| Reconciliation | list_reconciliation | ✅ |
| File Fallback | generate_instruction_file, import_status_file | ✅ |
| Sandbox | sandbox_seed_participants, sandbox_simulate_payment | ✅ |
| Status Events | list_status_events | ✅ |

## Dispatch Infrastructure

| Component | Status |
|-----------|--------|
| `event_outbox` table | ✅ Outbox pattern |
| `interbank-dispatch-worker` | ✅ 2-min cron, exponential backoff |
| Delivery modes | ✅ https_push, file, message_queue |
| `interbank-connector-inbound` | ✅ Receives pacs.002/camt.054 from banks |

## Correlation IDs

| ID Type | Tracked | Status |
|---------|---------|--------|
| `transfer_id` | ✅ Primary key | ✅ |
| `end_to_end_id` | ✅ In interbank_payments | ✅ |
| `instruction_id` | ✅ In interbank_messages | ✅ |
| `correlation_id` | ✅ Across outbox + status events | ✅ |

## Admin UI

| Page | Status |
|------|--------|
| `AdminInterbankPayments` — 3 tabs (Payments, Participants, Messages) | ✅ |
| Batch Reconciliation tab in `ReconciliationDashboard` | ✅ |

**Verdict: INTERBANK ENGINE COMPLETE ✅**
