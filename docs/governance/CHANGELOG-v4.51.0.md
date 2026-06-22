# CHANGELOG v4.51.0 — Promise to Pay (PTP) lifecycle

**Release date:** 2026-06-22
**Type:** Minor (additive)
**Breaking changes:** None

## Summary

Adds the Promise to Pay (PTP) lifecycle across API, admin console, and consumer
app. Introduces outbound institution webhooks for every PTP event with detailed
delivery logs, per-event subscription health, and idempotency on every
state-changing operation.

## Highlights

- **API.** Additive `/v1/ptp/ops` and `/v1/ptp/settle` operations covering
  create, partial settlement, reschedule, sweep, and break events. Every
  state-changing call requires a UUIDv4 `Idempotency-Key`.
- **Admin.** New console at `/admin/promise-to-pay` including a webhook health
  panel that highlights institutions missing required PTP event subscriptions.
- **Consumer app.** `/app/ptp` shows current promise state, next due date, and
  remaining balance. PTP alerts now appear in the consumer inbox with
  timestamps for created / partial / rescheduled / swept / broken events.
- **Outbound webhooks.** HMAC-SHA256 signed delivery for every PTP event with
  per-event subscription check and detailed delivery logs (request id, event
  name, institution id, response code, retry count).
- **Email.** New transactional templates: `ptp-created`, `ptp-partial`,
  `ptp-rescheduled`, `ptp-kept`, `ptp-broken`, registered in the shared
  template registry.
- **CI.** `.github/workflows/ptp-e2e.yml` ratchets the PTP edge functions
  end-to-end on every pull request.

## Standards cited

- RFC 7807 — Problem Details for HTTP APIs
- RFC 6920 — HMAC-SHA-256 named information signatures
- Guardian Standing Orders 2 (Ratchet), 4 (Surgeon), 6 (Version Gate), P7 (Changelog)

## Backwards compatibility

All changes are additive. No operationIds, schema names, or required fields
were renamed or removed (Standing Orders 1 and 4 honoured).
