# Phase 1B-R1I-c.2B — Security Review

Change is confined to response persistence and replay representation. Confirmed the diff does **not**:

- weaken tenant isolation — scope filter (`merchant_id + idempotency_key`) unchanged;
- weaken actor / client scope — no scope inputs added or removed;
- alter request fingerprinting — `requestHash` handling untouched;
- permit cross-operation replay — `resource` remains part of the reservation row;
- expose stored response data — bodyless replay emits no body at all;
- reorder authorization checks — callers still gate on their own auth before invoking the helper;
- store secrets or authentication headers — only `status` and (JSON body | null) are persisted;
- turn failed requests into successful replays — status is stored verbatim; 204 handling only affects the body wire representation;
- allow a body-bearing response to masquerade as a valid 204 — `storeIdempotency` **normalises** any body passed with status 204 to `null`; the raw value is not persisted, so replay cannot leak it.

### Attack model considered

- **Body-smuggling via 204:** blocked. `storeIdempotency` overwrites body with `null` when `isBodylessStatus(status)`; `idempotencyResponse` bodyless branch never reads `result.body`.
- **Downgrade attack via header injection:** `X-Idempotent-Replay: true` is the sole marker; no upstream input reaches the replay header set.
- **Cache-poisoning across tenants:** unchanged — helper still requires `merchant_id` match on lookup.
