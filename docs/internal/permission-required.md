# Permission Required — Pending Phase 1 Changes

**Default policy:** all changes are additive. This file lists changes that *might* affect existing behavior, per the Permission Gate. None are executed in Phase 0.

`KOB_PERMISSION_GRANTED` is **not** observed in this environment, so non-additive changes will not run automatically. Each item below is held until explicit approval.

| ID | Change | Routes / surfaces touched | Risk | Additive alternative | Bump |
|---|---|---|---|---|---|
| P1-A | Add `Idempotency-Key` parameter ref to 5 DELETE operations | `/v1/gateway/beneficiaries/{id}`, `/v1/gateway/payment-links/{id}`, `/v1/gateway/subscriptions/{id}`, `/v1/gateway/subaccounts/{id}`, `/v1/gateway/customers/{id}/tokens/{tokenId}` | **Low** — header is optional, existing clients keep working | Already additive | patch 4.26.8 |
| P1-B | Add canonical 409 + 429 responses to ~40 gateway mutation ops | `/v1/gateway/*` mutations | **Low** — additive responses. Health/JWKS/OIDC excluded. | Already additive | patch 4.26.9 |
| P1-C | Add `starting_after` + `ending_before` cursor params to 38 offset-only list ops | `/v1/gateway/{disputes,settlements,beneficiaries,payment-links,payment-plans,subscriptions,subaccounts,customers}`, `/v1/woocommerce/transactions`, `/v1/ledger/journal`, etc. | **Low–Medium** — Edge Function handlers must accept new params (ignore-if-absent → safe). Existing `offset` clients unchanged. | Already additive | minor 4.27.0 |
| P1-D | Add `apiKey` security scheme (Stripe-style `sk_live_*`) | `components.securitySchemes.secretKey` + reference on existing ops alongside `bearerAuth` | **Low** — runtime already accepts these tokens via `bearerAuth`; this only labels them properly in tooling | Already additive | patch 4.26.x |
| P1-E | Populate top-level OpenAPI 3.1 `webhooks` block from `src/lib/webhook-event-schemas.ts` | spec-only | **Very low** — purely descriptive | Already additive | patch 4.26.x |
| P1-F | Add `GET` + `POST` for `/v1/gateway/customers/{customerId}/tokens` | New paths | **Low** — new operations, no existing client affected | Already additive | minor 4.27.0 |
| **P1-G** | **Reconcile `webhook_inbox` schema** so inbound provider webhooks persist correctly | DB table `webhook_inbox` (ADD COLUMN provider, event_type, status; backfill; add 2 indexes). No code edits. | **Low** — additive ALTER, no DROP, no rename. Existing `source`/`is_processed` columns kept. | Option A (edit receivers to write `source`/`is_processed`) is also available; Option B (migration) preferred for observability | n/a (no spec change) |

## How to authorize

To proceed with a Phase 1 change:

1. Reply with the change ID(s) you authorize, e.g. *"Approve P1-A, P1-G"*.
2. I will land them as separate turns, one diff per turn (Surgeon Rule).
3. Each turn will include:
   - the actual change (spec / migration / code as listed),
   - a Vitest assertion to ratchet it (Standing Order 2),
   - a changelog entry within 48 h (Order P7),
   - a version bump per Standing Order 6.

Nothing in this file has been executed yet.
