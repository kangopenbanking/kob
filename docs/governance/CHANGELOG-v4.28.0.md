# Changelog v4.28.0

**Released:** 2026-05-02
**Type:** minor (additive — no breaking changes)

## New endpoints

| Method | Path | Purpose | Standard |
|---|---|---|---|
| GET | `/v1/spec/versions` | List published OpenAPI versions with snapshot availability. | Standing Order 6 (Version Gate) |
| GET | `/v1/spec/diff?from=&to=` | Structured diff between two published OpenAPI versions; flags breaking changes per Standing Order 1 (The Lock). | RFC 6902 (JSON Patch — diff intent) |
| POST | `/v1/sandbox/providers/{provider}/simulate` | End-to-end provider event simulator (Stripe, Flutterwave, PayPal). Signs the event with the provider's secret and forwards it through the canonical Kang receiver. | RFC 6749 §4.4, FAPI 1.0 §6.2.1.13 |

## New developer portal pages

- `/developer/spec-diff` (PERMANENT PUBLIC) — interactive UI for the new diff endpoint.
- Sandbox simulator tab embedded in `/developer/sandbox/simulate-webhooks` for per-provider runs.
- `ConnectorSandboxSimulator` widget embedded in `/developer/connectors/bank-connector-runbook`.

## Admin enhancements

- `AdminWebhookReplay` gains a **Replay history** tab backed by `webhook_replay_audit`, plus a **Replay all failed** bulk action (sequential, idempotency-preserving).
- Institution **API Clients** registration shows the `client_credentials` token-exchange snippet pre-filled with the new `client_id`.

## Spec governance

- `info.version` 4.27.3 → 4.28.0 (Standing Order 6 — minor, additive).
- New tag `Specification` declared and referenced (Standing Order 5 — Dead Code Rule).
- Snapshot of v4.27.3 stored at `public/openapi-history/openapi-4.27.3.json` so future diffs work.
- Postman collection `Kang_Open_Banking_API_v4.28.0.postman_collection.json` published.

## Standing Orders satisfied

- **SO-1 The Lock:** No rename or removal — fully additive.
- **SO-2 The Ratchet:** All v4.27.3 floors (429 / 401 / 400 / `x-fapi-interaction-id`) preserved.
- **SO-3 Audit Trail:** RFCs 6902, 6749 §4.4 cited above.
- **SO-4 Surgeon Rule:** Three new ops, one new tag — additive only.
- **SO-5 Dead Code Rule:** New `Specification` tag is referenced by both new spec ops.
- **SO-6 Version Gate:** Minor increment 4.27.3 → 4.28.0.
- **SO-7 Five Roles:** Guardian/Architect/Surgeon/Auditor/Scorekeeper — applied throughout this release.
