# Pay by Bank — Rails, Preflight & Fallback

> Public mirror of [`developer-portal/reference/pay-by-bank-rails.md`](../developer-portal/reference/pay-by-bank-rails.md). The developer portal is the canonical source.

The `pay-by-bank` endpoint routes a single integrator request across multiple underlying rails based on bank and currency. See the canonical reference for the full schema; key contracts:

- `action: "preflight_rails"` — capability probe returning `rails[]` and `recommended_rail`.
- `create_intent` response now includes `rail` and `rail_descriptor` so clients render the right UI.
- `bank_not_linked` (422) returns `fallback.retry_with`, an additive hint that lets integrators replay the same `Idempotency-Key` against the hosted-checkout rail without losing in-flight state.
- `get_intent` returns a `timeline[]` of webhook-driven state transitions: `created → awaiting_webhook → confirmed | failed`.
- All errors carry `{ error, code, message, rail_available }`.

Idempotency follows the platform-wide [Idempotency](./idempotency.md) contract — UUID v4, 24h replay TTL, `X-Idempotent-Replay` header on replays.
