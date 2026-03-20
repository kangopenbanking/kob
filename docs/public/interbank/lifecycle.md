# Interbank Payment Lifecycle

## Status State Machine

```
  ┌─────────┐
  │ created │
  └────┬────┘
       │ validate
  ┌────▼─────┐
  │validated │
  └────┬─────┘
       │ submit (generates pacs.008 + outbox event)
  ┌────▼─────┐
  │submitted │──────────┐
  └────┬─────┘          │
       │ pacs.002       │ pacs.002
       │ (ACCP)         │ (RJCT)
  ┌────▼─────┐    ┌─────▼────┐
  │ accepted │    │ rejected │
  └────┬─────┘    └──────────┘
       │
       │ (optional)
  ┌────▼──────┐
  │in_process │
  └────┬──────┘
       │ camt.054
  ┌────▼────┐
  │ settled │
  └─────────┘

  Any terminal → reversed (admin only)
  Any active  → failed / expired
```

## Transition Rules

| From | Allowed To |
|---|---|
| created | validated, failed, expired |
| validated | submitted, failed, expired |
| submitted | accepted, rejected, failed, expired |
| accepted | in_process, settled, failed |
| in_process | settled, failed |
| rejected | reversed |
| settled | reversed |
| failed | reversed |
| reversed | (terminal) |
| expired | (terminal) |

## Event-Driven Updates

Every status transition creates an `interbank_status_events` record:
- `payment_id` — reference to the payment
- `status_from` / `status_to` — transition
- `source` — engine, connector, admin, or reconciliation
- `correlation_id` — for tracing
- `details_json` — ISO message IDs, reasons, metadata
